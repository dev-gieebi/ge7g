<?php

namespace App\Http\Requests;

/**
 * Commande passée depuis l'espace client connecté : mêmes règles que la
 * boutique publique (sans honeypot), plus l'annotation facultative. Le
 * client ne demande pas de remise.
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
     * Lignes du client : produit du catalogue (`produit_id`) ou produit
     * inconnu décrit librement (`designation`), quantité saisie librement.
     *
     * @return array<string, mixed>
     */
    public static function reglesLignes(): array
    {
        return [
            'lignes' => 'required|array|min:1|max:50',
            'lignes.*.produit_id' => 'nullable|required_without:lignes.*.designation|integer|exists:products,id',
            'lignes.*.designation' => 'nullable|required_without:lignes.*.produit_id|string|max:150',
            'lignes.*.precision' => 'nullable|string|max:300',
            'lignes.*.quantite' => 'required|numeric|min:0.01|max:100000',
        ];
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

        return array_merge($rules, self::reglesLignes(), [
            'annotation' => 'nullable|string|max:1000',
        ]);
    }
}
