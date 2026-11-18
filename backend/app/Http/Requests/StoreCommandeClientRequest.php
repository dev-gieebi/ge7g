<?php

namespace App\Http\Requests;

/**
 * Commande passée depuis l'espace client connecté : mêmes règles que la
 * boutique publique (sans honeypot), plus l'annotation et la demande de
 * remise facultatives.
 */
class StoreCommandeClientRequest extends StoreCommandeRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'CLIENT';
    }

    /**
     * Nom et téléphone viennent du compte : le client ne les ressaisit pas.
     */
    protected function prepareForValidation(): void
    {
        $user = $this->user();

        $this->merge([
            'nom' => $user?->name ?: $this->input('nom'),
            'telephone' => $user?->phone ?: (string) $this->input('telephone', ''),
        ]);

        parent::prepareForValidation();
    }

    /**
     * Le téléphone n'est pas saisi au checkout : une erreur vient du compte.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'telephone.required' => 'Aucun numéro de téléphone sur votre compte. Contactez G-ENERGIE 7 pour le mettre à jour.',
            'telephone.regex' => 'Le numéro de téléphone de votre compte est invalide. Contactez G-ENERGIE 7 pour le corriger.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['site_web']);

        return array_merge($rules, [
            'annotation' => 'nullable|string|max:1000',
            'remise_taux' => 'nullable|numeric|min:0.5|max:100',
            'remise_motif' => 'nullable|string|max:500',
        ]);
    }
}
