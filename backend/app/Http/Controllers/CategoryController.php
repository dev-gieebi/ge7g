<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Support\Doublon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    private const MANAGE_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN', 'CDG_ADMIN'];

    private function authorizeUser(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        if (! in_array($user->role, self::MANAGE_ROLES, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        if (! $request->hasAny(['search', 'with_trashed', 'sort', 'dir', 'per_page'])) {
            return Cache::remember('categories.index', 300, fn () => $this->buildIndex($request));
        }

        return $this->buildIndex($request);
    }

    private function buildIndex(Request $request): JsonResponse
    {
        $query = Category::query();

        if ($request->boolean('with_trashed')) {
            $query->withTrashed();
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
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
            'parent_id' => 'nullable|integer|exists:categories,id',
        ]);

        // Pas deux catégories du même nom.
        Doublon::refuser(Category::class, 'name', $validated['name'], null, 'La catégorie');

        $slug = $this->generateUniqueSlug($validated['name']);

        $category = Category::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'parent_id' => $validated['parent_id'] ?? null,
        ]);

        Cache::forget('categories.index');

        return response()->json(['data' => $category], 201);
    }

    public function show(Request $request, Category $category): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $category]);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|integer|exists:categories,id',
        ]);

        Doublon::refuser(Category::class, 'name', $validated['name'], $category->id, 'La catégorie');

        $slug = $this->generateUniqueSlug($validated['name'], $category->id);

        $category->update([
            'name' => $validated['name'],
            'slug' => $slug,
            'parent_id' => $validated['parent_id'] ?? $category->parent_id,
        ]);

        Cache::forget('categories.index');

        return response()->json(['data' => $category]);
    }

    /** Suppression : Super admin uniquement, et jamais une catégorie encore utilisée par un produit. */
    public function destroy(Request $request, Category $category): Response
    {
        abort_unless($request->user()->role === 'SUPERADMIN', 403, 'Suppression réservée au Super admin.');

        $nombre = Product::where('category_id', $category->id)->count();
        if ($nombre > 0) {
            throw ValidationException::withMessages([
                'category' => "Impossible de supprimer : la catégorie « {$category->name} » est liée à {$nombre} produit(s).",
            ]);
        }

        $category->delete();

        Cache::forget('categories.index');

        return response()->noContent();
    }

    private function generateUniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $counter = 1;

        $query = Category::query();
        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        while ($query->clone()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$counter;
            $counter++;
        }

        return $slug;
    }
}
