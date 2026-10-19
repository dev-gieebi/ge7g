<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Générateur PDF minimal (PDF 1.4, Times-Roman/Times-Bold, WinAnsiEncoding)
 * sans dépendance externe — suffisant pour les documents imprimables.
 * Origine en bas à gauche ; coordonnées en points (A4 = 595 × 842 pt).
 */
class SimplePdf
{
    /** @var list<list<string>> */
    private array $pages = [];

    /** @var list<string> */
    private array $ops = [];

    public function __construct()
    {
        $this->addPage();
    }

    public function addPage(): static
    {
        if ($this->ops !== []) {
            $this->pages[] = $this->ops;
        }
        $this->ops = [];

        return $this;
    }

    /** Texte simple. F1 = Times-Roman, F2 = Times-Bold. */
    public function text(float $x, float $y, string $text, int $size = 10, bool $bold = false): static
    {
        $encoded = mb_convert_encoding($text, 'Windows-1252', 'UTF-8');
        $encoded = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $encoded);
        $this->ops[] = sprintf('BT /%s %d Tf %.1f %.1f Td (%s) Tj ET', $bold ? 'F2' : 'F1', $size, $x, $y, $encoded);

        return $this;
    }

    public function line(float $x1, float $y1, float $x2, float $y2, float $width = 0.5): static
    {
        $this->ops[] = sprintf('%.1f w %.1f %.1f m %.1f %.1f l S', $width, $x1, $y1, $x2, $y2);

        return $this;
    }

    /** Rectangle plein (gris 0-1). */
    public function rect(float $x, float $y, float $w, float $h, float $gray = 0.92): static
    {
        $this->ops[] = sprintf('%.2f g %.1f %.1f %.1f %.1f re f 0 g', $gray, $x, $y, $w, $h);

        return $this;
    }

    public function string(): string
    {
        if ($this->ops !== []) {
            $this->pages[] = $this->ops;
            $this->ops = [];
        }

        $objects = [];
        // 1: catalogue, 2: pages, 3/4: polices, puis par page : objet page + contenu.
        $kids = [];
        $n = 5;
        foreach ($this->pages as $ops) {
            $stream = implode("\n", $ops);
            $kids[] = ($n).' 0 R';
            $objects[$n++] = '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents '.($n).' 0 R>>';
            $objects[$n++] = '<</Length '.strlen($stream).'>>stream'."\n".$stream."\nendstream";
        }

        $objects[1] = '<</Type/Catalog/Pages 2 0 R>>';
        $objects[2] = '<</Type/Pages/Kids['.implode(' ', $kids).']/Count '.count($kids).'>>';
        $objects[3] = '<</Type/Font/Subtype/Type1/BaseFont/Times-Roman/Encoding/WinAnsiEncoding>>';
        $objects[4] = '<</Type/Font/Subtype/Type1/BaseFont/Times-Bold/Encoding/WinAnsiEncoding>>';
        ksort($objects);

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $num => $body) {
            $offsets[$num] = strlen($pdf);
            $pdf .= "{$num} 0 obj\n{$body}\nendobj\n";
        }

        $xref = strlen($pdf);
        $count = count($objects) + 1;
        $pdf .= "xref\n0 {$count}\n0000000000 65535 f \n";
        for ($i = 1; $i < $count; $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i] ?? 0);
        }
        $pdf .= "trailer\n<</Size {$count}/Root 1 0 R>>\nstartxref\n{$xref}\n%%EOF";

        return $pdf;
    }

    public function download(string $filename): BinaryFileResponse
    {
        $path = tempnam(sys_get_temp_dir(), 'pdf');
        file_put_contents($path, $this->string());

        return response()->download($path, $filename, ['Content-Type' => 'application/pdf'])->deleteFileAfterSend();
    }

    public function stream(string $filename): Response
    {
        return response($this->string(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }
}
