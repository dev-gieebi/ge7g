<?php

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

#[Fillable(['reference', 'name', 'category_id', 'unit_id', 'sale_price', 'purchase_price', 'margin', 'margin_percent', 'stock_quantity', 'reserved_quantity', 'min_stock', 'physical_stock', 'physical_stock_at', 'image_url', 'visible_boutique', 'description_publique', 'mis_en_avant'])]
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    protected $appends = ['available_quantity'];

    protected function casts(): array
    {
        return [
            'sale_price' => 'decimal:4',
            'purchase_price' => 'decimal:4',
            'margin' => 'decimal:4',
            'margin_percent' => 'decimal:4',
            'stock_quantity' => 'decimal:4',
            'physical_stock' => 'decimal:4',
            'physical_stock_at' => 'datetime',
            'reserved_quantity' => 'decimal:4',
            'min_stock' => 'decimal:4',
        ];
    }

    
    protected function availableQuantity(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->stock_quantity - $this->reserved_quantity,
        );
    }

    /** Extensions reconnues comme image produit. */
    private const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    /** Cache (par requête) : slug du nom de dossier => dossier réel sous `products/`. */
    private static ?array $imageFolders = null;

    /**
     * `image_url` stocke un chemin relatif (`products/…/image.jpg`) : l'URL
     * absolue affichable est générée ici pour suivre le domaine qui sert
     * l'API. Le fichier doit exister sur le disque ; sinon on cherche le
     * dossier qui porte le nom du produit. Aucune image trouvée → null
     * (le front affiche alors les initiales du produit).
     * Les URL externes et data-URI restent inchangées.
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::make(
            get: function ($value) {
                if ($value && (Str::startsWith($value, 'data:')
                    || (Str::startsWith($value, ['http://', 'https://']) && ! Str::contains($value, '/storage/')))) {
                    return $value;
                }

                $path = $this->resolveImagePath($value);

                // Segments encodés : les dossiers peuvent contenir accents/espaces.
                return $path
                    ? url('storage/'.implode('/', array_map('rawurlencode', explode('/', $path))))
                    : null;
            },
        );
    }

    /**
     * Chemin relatif (disque public) de l'image réellement présente :
     * 1. le chemin enregistré, s'il existe ;
     * 2. sinon une image du dossier dont le nom correspond au produit
     *    (`products/{nom}-{id}` puis `products/{nom}`).
     */
    public function resolveImagePath(?string $stored): ?string
    {
        $disk = Storage::disk('public');

        if ($stored) {
            $relative = Str::contains($stored, '/storage/')
                ? Str::after($stored, '/storage/')
                : ltrim($stored, '/');

            if ($disk->exists($relative)) {
                return $relative;
            }
        }

        $slug = Str::slug((string) $this->name);
        if ($slug === '') {
            return null;
        }

        foreach (self::matchingFolders($slug, $this->id) as $folder) {
            $images = collect($disk->files($folder))
                ->filter(fn (string $f) => in_array(Str::lower(pathinfo($f, PATHINFO_EXTENSION)), self::IMAGE_EXTENSIONS, true))
                ->sortBy(fn (string $f) => Str::startsWith(basename($f), 'image.') ? 0 : 1)
                ->values();

            if ($images->isNotEmpty()) {
                return $images->first();
            }
        }

        return null;
    }

    /**
     * Dossiers d'images correspondant au nom du produit, du plus sûr au
     * moins sûr :
     * 1. nom identique (`{nom}-{id}` puis `{nom}`), sans casse ni accents ;
     * 2. nom proche (ex. « BOITIER ELECTRIQUE 86X86X50 » ↔
     *    `boîte-électrique-86x86x50`) : les nombres doivent être identiques
     *    et les lettres semblables à 80 % au moins.
     *
     * @return list<string>
     */
    private static function matchingFolders(string $slug, ?int $id): array
    {
        $folders = self::imageFolders();
        $result = [];

        foreach ([$slug.'-'.$id, $slug] as $exact) {
            if (isset($folders[$exact])) {
                $result[] = $folders[$exact];
            }
        }

        $nombres = self::nombres($slug);
        $lettres = self::lettres($slug);
        $proches = [];

        foreach ($folders as $folderSlug => $dir) {
            if (in_array($dir, $result, true) || self::nombres($folderSlug) !== $nombres) {
                continue;
            }

            $autres = self::lettres($folderSlug);
            $max = max(strlen($lettres), strlen($autres));
            if ($max === 0) {
                continue;
            }

            $score = 1 - levenshtein($lettres, $autres) / $max;
            if ($score >= 0.8) {
                $proches[$dir] = $score;
            }
        }

        arsort($proches);

        return [...$result, ...array_keys($proches)];
    }

    /** Suite des nombres d'un slug (« 86x86x50 » → 86|86|50). */
    private static function nombres(string $slug): string
    {
        preg_match_all('/\d+/', $slug, $m);

        return implode('|', $m[0]);
    }

    /** Lettres seules d'un slug, sans séparateurs ni chiffres. */
    private static function lettres(string $slug): string
    {
        return (string) preg_replace('/[^a-z]/', '', $slug);
    }

    /**
     * Dossiers d'images (`products/` et `produits/`) indexés par le slug de
     * leur nom : la comparaison ignore casse, accents et séparateurs.
     */
    private static function imageFolders(): array
    {
        if (self::$imageFolders === null) {
            $disk = Storage::disk('public');
            self::$imageFolders = collect(['products', 'produits'])
                ->flatMap(fn (string $racine) => $disk->directories($racine))
                ->mapWithKeys(fn (string $dir) => [Str::slug(basename($dir)) => $dir])
                ->all();
        }

        return self::$imageFolders;
    }

    /** À appeler après création/suppression d'un dossier d'images. */
    public static function forgetImageFolders(): void
    {
        self::$imageFolders = null;
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function prices(): HasMany
    {
        return $this->hasMany(Price::class);
    }

    /**
     * Prix de vente boutique : avec une ville, le prix de la zone en priorité
     * puis « toutes villes » ; sans ville, le prix POS puis « toutes villes ».
     * Retombe sur `sale_price` si aucune ligne de barème n'existe.
     */
    public function prixBoutique(?int $zoneId = null): int
    {
        $prices = $this->relationLoaded('prices') ? $this->prices : $this->prices()->get();

        $prix = $zoneId
            ? $prices
                ->filter(fn (Price $p) => $p->zone_id === null || (int) $p->zone_id === $zoneId)
                ->sortByDesc(fn (Price $p) => (int) $p->zone_id === $zoneId ? 1 : 0)
                ->first()?->amount
            : $prices
                ->filter(fn (Price $p) => $p->zone_id === null || $p->for_pos)
                ->sortByDesc(fn (Price $p) => (int) $p->for_pos)
                ->first()?->amount;

        return (int) round((float) ($prix ?? $this->sale_price));
    }
}
