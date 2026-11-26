<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\CommandeLigne;
use App\Models\PosSaleItem;
use App\Models\Price;
use App\Models\Product;
use App\Models\PurchaseItem;
use App\Models\QuoteItem;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    private const MANAGE_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN', 'CDG_ADMIN'];

    /** Lecture catalogue : circuit commercial (proformas, factures, suivi). */
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
            $query->orderBy('name')->orderBy('id');
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
            'visible_boutique' => 'sometimes|boolean',
            'description_publique' => 'nullable|string|max:2000',
            'mis_en_avant' => 'sometimes|boolean',
        ]);

        $this->refuserDoublon($validated['name'], null);

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

    /**
     * Anti-doublon : un produit de même désignation et même type existe
     * déjà (majuscules et espaces en trop ignorés) → enregistrement refusé.
     */
    private function refuserDoublon(string $name, ?string $type, ?int $ignorer = null): void
    {
        $normaliser = fn (?string $v) => mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', (string) $v)));
        $nom = $normaliser($name);
        $variante = $normaliser($type);

        $existant = Product::query()
            ->when($ignorer, fn ($q) => $q->whereKeyNot($ignorer))
            ->select(['id', 'name', 'type', 'reference'])
            ->cursor()
            ->first(fn (Product $p) => $normaliser($p->name) === $nom && $normaliser($p->type) === $variante);

        if ($existant) {
            throw ValidationException::withMessages([
                'name' => 'Ce produit existe déjà : « '.$existant->name.($existant->type ? ' · '.$existant->type : '').' » (réf. '.$existant->reference.').',
            ]);
        }
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
            'visible_boutique' => 'sometimes|boolean',
            'description_publique' => 'nullable|string|max:2000',
            'mis_en_avant' => 'sometimes|boolean',
        ]);

        $this->refuserDoublon($validated['name'], $product->type, $product->id);

        $data = $this->prepareData($validated);
        // Vitrine : les champs absents conservent la valeur existante.
        $data['visible_boutique'] = (bool) ($validated['visible_boutique'] ?? $product->visible_boutique);
        $data['mis_en_avant'] = (bool) ($validated['mis_en_avant'] ?? $product->mis_en_avant);
        $data['description_publique'] = array_key_exists('description_publique', $validated) ? $validated['description_publique'] : $product->description_publique;

        $imageUrl = $this->handleImage($validated['image_url'] ?? null, $product);

        if ((int) $validated['category_id'] !== $product->category_id || ! Str::startsWith($product->reference, $this->categoryPrefix((int) $validated['category_id']).'-')) {
            $data['reference'] = $this->generateReference((int) $validated['category_id']);
        }

        $product->update([...$data, 'image_url' => $imageUrl]);

        $product->load(['category', 'unit']);

        return response()->json(['data' => $product]);
    }

    /**
     * Suppression : Super admin uniquement. Un produit présent dans
     * l'historique (ventes, achats, proformas, commandes, mouvements de
     * stock) ne peut pas être supprimé ; ses prix partent avec lui.
     */
    public function destroy(Request $request, Product $product): Response
    {
        abort_unless($request->user()->role === 'SUPERADMIN', 403, 'Suppression réservée au Super admin.');

        $utilisations = array_filter([
            'ventes' => PosSaleItem::where('product_id', $product->id)->exists(),
            'achats' => PurchaseItem::where('product_id', $product->id)->exists(),
            'proformas' => QuoteItem::where('product_id', $product->id)->exists(),
            'commandes' => CommandeLigne::where('produit_id', $product->id)->exists(),
            'mouvements de stock' => StockMovement::where('product_id', $product->id)->exists(),
        ]);

        if ($utilisations !== []) {
            throw ValidationException::withMessages([
                'product' => "Impossible de supprimer : le produit « {$product->name} » est utilisé dans des ".implode(', ', array_keys($utilisations)).'.',
            ]);
        }

        DB::transaction(function () use ($product) {
            Price::withTrashed()->where('product_id', $product->id)->forceDelete();
            $product->delete();
        });

        $this->deleteImage($product->getRawOriginal('image_url'));

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
            // Vitrine boutique en ligne : visibilité, description publique, mise en avant.
            // Nouveau produit : publié sur la boutique automatiquement (la
            // modification d'un produit existant garde son réglage, voir update()).
            'visible_boutique' => (bool) ($validated['visible_boutique'] ?? true),
            'description_publique' => $validated['description_publique'] ?? null,
            'mis_en_avant' => (bool) ($validated['mis_en_avant'] ?? false),
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
            // URL déjà servie par l'API (…/storage/x) : on garde le chemin
            // relatif pour ne pas figer le domaine dans la base.
            return Str::contains($imageUrl, '/storage/')
                ? Str::after($imageUrl, '/storage/')
                : $imageUrl;
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

        $folder = $this->imageFolder($product);
        $path = $folder.'/image.'.$extension;

        // Échouer explicitement si l'écriture ne passe pas (stockage non
        // inscriptible) plutôt que d'enregistrer un chemin vers rien.
        if (! Storage::disk('public')->put($path, $decoded)) {
            throw ValidationException::withMessages([
                'image_url' => "Impossible d'enregistrer l'image sur le serveur.",
            ]);
        }

        Product::forgetImageFolders();

        // Chemin relatif uniquement : l'URL absolue est générée à la lecture
        // (accessor image_url) pour suivre l'environnement qui sert l'API.
        return $path;
    }

    /**
     * Dossier de l'image : `products/{nom-du-produit}`. Si un autre produit
     * porte le même nom, l'identifiant est ajouté pour éviter d'écraser
     * son image.
     */
    private function imageFolder(Product $product): string
    {
        $slug = Str::slug($product->name);
        $base = 'products/'.($slug !== '' ? $slug : 'produit-'.$product->id);

        $occupe = Product::where('id', '!=', $product->id)
            ->where('image_url', 'like', $base.'/%')
            ->exists();

        return $occupe ? $base.'-'.$product->id : $base;
    }

    private function deleteImage(?string $imageUrl): void
    {
        if (empty($imageUrl)) {
            return;
        }

        // Gère les anciennes URL absolues (…/storage/x) et les chemins relatifs.
        $relativePath = Str::contains($imageUrl, '/storage/')
            ? Str::after($imageUrl, '/storage/')
            : $imageUrl;

        if (Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }
    }
}
