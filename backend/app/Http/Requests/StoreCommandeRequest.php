<?php

namespace App\Http\Requests;

use App\Services\CommandeService;
use Illuminate\Foundation\Http\FormRequest;

class StoreCommandeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'telephone' => CommandeService::normaliserTelephone((string) $this->input('telephone', '')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'nom' => 'required|string|min:2|max:100',
            'telephone' => ['required', 'regex:/^\+241[0-9]{8,9}$/'],
            'ville' => 'required|string|max:100',
            'quartier' => 'required|string|max:100',
            'point_repere' => 'required|string|max:150',
            'note' => 'nullable|string|max:500',
            'zone_id' => 'nullable|integer|exists:zones,id',
            'lignes' => 'required|array|min:1|max:50',
            'lignes.*.produit_id' => 'required|integer|exists:products,id',
            'lignes.*.quantite' => 'required|numeric|min:0.01|max:100000',
            // Champ piège invisible : rempli uniquement par les robots.
            'site_web' => 'prohibited',
        ];
    }
}
