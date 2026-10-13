<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    private const MANAGE_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN', 'CDG_ADMIN'];

    /** Lecture catalogue : circuit commercial (devis, factures, suivi). */
    private const VIEW_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN', 'CAISSIER', 'CDG_ADMIN'];

    private function authorizeUser(Request $request, array $roles = self::MANAGE_ROLES): User
    {
        /** @var User $user */
        $user = $request->user();

        if (! in_array($user->role, $roles, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request, self::VIEW_ROLES);

        $query = Product::query()->with(['category', 'unit']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('reference', 'like', "%{$search}%");
            });
        }

        if ($sort = $request->input('sort')) {
            $direction = $request->input('dir') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($sort, $direction);
        } else {
            $query->orderBy('id');
        }

        $perPage = (int) $request->input('per_page', 20);
        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category_id' => 'required|integer|exists:categories,id',
            'unit_id' => 'required|integer|exists:units,id',
            'sale_price' => 'sometimes|numeric|min:0',
            'purchase_price' => 'sometimes|numeric|min:0',
            'min_stock' => 'sometimes|numeric|min:0',
            'image_url' => 'nullable',
        ]);

        $data = $this->prepareData($validated);
        $data['reference'] = $this->generateReference((int) $validated['category_id']);

        $product = Product::create($data);

        if (! empty($validated['image_url'])) {
            $imageUrl = $this->handleImage($validated['image_url'], $product);
            if ($imageUrl !== null) {
                $product->update(['image_url' => $imageUrl]);
            }
        }

        $product->load(['category', 'unit']);

        return response()->json(['data' => $product], 201);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        $this->authorizeUser($request, self::VIEW_ROLES);

        $product->load(['category', 'unit']);

        return response()->json(['data' => $product]);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category_id' => 'required|integer|exists:categories,id',
            'unit_id' => 'required|integer|exists:units,id',
            'sale_price' => 'sometimes|numeric|min:0',
            'purchase_price' => 'sometimes|numeric|min:0',
            'min_stock' => 'sometimes|numeric|min:0',
            'image_url' => 'nullable',
        ]);

        $data = $this->prepareData($validated);
        $imageUrl = $this->handleImage($validated['image_url'] ?? null, $product);

        if ((int) $validated['category_id'] !== $product->category_id || ! Str::startsWith($product->reference, $this->categoryPrefix((int) $validated['category_id']).'-')) {
            $data['reference'] = $this->generateReference((int) $validated['category_id']);
        }

        $product->update([...$data, 'image_url' => $imageUrl]);

        $product->load(['category', 'unit']);

        return response()->json(['data' => $product]);
    }

    public function destroy(Request $request, Product $product): Response
    {
        $this->authorizeUser($request);

        $this->deleteImage($product->image_url);
        $product->delete();

        return response()->noContent();
    }

    private function prepareData(array $validated): array
    {
        $salePrice = (float) ($validated['sale_price'] ?? 0);
        $purchasePrice = (float) ($validated['purchase_price'] ?? 0);
        $margin = $salePrice - $purchasePrice;
        $marginPercent = $purchasePrice > 0 ? ($margin / $purchasePrice) * 100 : 0;

        return [
            'name' => $validated['name'],
            'category_id' => $validated['category_id'],
            'unit_id' => $validated['unit_id'],
            'sale_price' => $salePrice,
            'purchase_price' => $purchasePrice,
            'margin' => $margin,
            'margin_percent' => $marginPercent,
            'min_stock' => (float) ($validated['min_stock'] ?? 0),
        ];
    }

    /**
     * Référence automatique : 4 premières lettres de la catégorie + compteur
     * propre à la catégorie (chaque catégorie commence à 0001).
     */
    private function generateReference(int $categoryId): string
    {
        $prefix = $this->categoryPrefix($categoryId);

        $next = Product::query()
            ->where('category_id', $categoryId)
            ->where('reference', 'like', $prefix.'-%')
            ->pluck('reference')
            ->map(fn (string $ref) => (int) substr($ref, strlen($prefix) + 1))
            ->max() + 1;

        do {
            $reference = sprintf('%s-%04d', $prefix, $next++);
        } while (Product::where('reference', $reference)->exists());

        return $reference;
    }

    private function categoryPrefix(int $categoryId): string
    {
        $name = (string) Category::findOrFail($categoryId)->name;
        $prefix = Str::upper(Str::substr(preg_replace('/[^A-Za-z0-9]/', '', Str::ascii($name)) ?? '', 0, 4));

        return $prefix === '' ? 'PRD' : $prefix;
    }

    private function handleImage(mixed $imageUrl, Product $product): ?string
    {
        if (empty($imageUrl)) {
            $this->deleteImage($product->image_url);

            return null;
        }

        $imageUrl = (string) $imageUrl;

        if (! Str::startsWith($imageUrl, 'data:image')) {
            return $imageUrl;
        }

        $this->deleteImage($product->image_url);

        [$mime, $base64] = explode(';', $imageUrl, 2);
        $data = explode(',', $base64, 2)[1] ?? null;

        if (! $data) {
            return $product->image_url;
        }

        $decoded = base64_decode($data);

        $extension = 'jpg';
        if (str_contains($mime, 'image/png')) {
            $extension = 'png';
        } elseif (str_contains($mime, 'image/jpeg')) {
            $extension = 'jpg';
        } elseif (str_contains($mime, 'image/webp')) {
            $extension = 'webp';
        } elseif (str_contains($mime, 'image/gif')) {
            $extension = 'gif';
        }

        $folder = 'products/'.$product->id.'-'.Str::slug($product->name);
        $path = $folder.'/image.'.$extension;

        Storage::disk('public')->put($path, $decoded);

        return url('storage/'.$path);
    }

    private function deleteImage(?string $imageUrl): void
    {
        if (empty($imageUrl)) {
            return;
        }

        $relativePath = Str::after($imageUrl, '/storage/');

        if ($relativePath !== $imageUrl && Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }
    }
}
