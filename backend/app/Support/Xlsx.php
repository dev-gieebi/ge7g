<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Génère un classeur .xlsx (OpenXML) sans dépendance externe.
 *
 * Chaque feuille : rows = liste de lignes, chaque cellule = [valeur, style].
 * Styles : 1 = titre, 2 = en-tête (gras, fond, bordure), 3 = texte,
 * 4 = nombre, 5 = texte en gras, 6 = nombre en gras.
 */
class Xlsx
{
    /**
     * @param  list<array{name: string, rows: list<list<array{0: mixed, 1: int}>>, merges?: list<string>}>  $sheets
     */
    public static function download(array $sheets, string $filename): BinaryFileResponse
    {
        $path = tempnam(sys_get_temp_dir(), 'xlsx');
        $zip = new \ZipArchive;
        $zip->open($path, \ZipArchive::OVERWRITE);

        $overrides = '';
        $workbookSheets = '';
        $workbookRels = '';
        foreach ($sheets as $i => $sheet) {
            $n = $i + 1;
            $overrides .= '<Override PartName="/xl/worksheets/sheet'.$n.'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
            $workbookSheets .= '<sheet name="'.htmlspecialchars($sheet['name'], ENT_QUOTES | ENT_XML1).'" sheetId="'.$n.'" r:id="rId'.$n.'"/>';
            $workbookRels .= '<Relationship Id="rId'.$n.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'.$n.'.xml"/>';
            $zip->addFromString('xl/worksheets/sheet'.$n.'.xml', self::sheetXml($sheet['rows'], $sheet['merges'] ?? []));
        }
        $workbookRels .= '<Relationship Id="rId'.(count($sheets) + 1).'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';

        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'.$overrides.'</Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'.$workbookSheets.'</sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'.$workbookRels.'</Relationships>');
        $zip->addFromString('xl/styles.xml', self::STYLES);
        $zip->close();

        return response()->download($path, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend();
    }

    /**
     * @param  list<list<array{0: mixed, 1: int}>>  $rows
     * @param  list<string>  $merges  Plages fusionnées (ex. « A1:S1 »)
     */
    private static function sheetXml(array $rows, array $merges): string
    {
        $rowsXml = '';
        foreach ($rows as $r => $cells) {
            $rowNum = $r + 1;
            $rowsXml .= '<row r="'.$rowNum.'">';
            foreach ($cells as $c => [$value, $style]) {
                $ref = self::colLetter($c + 1).$rowNum;
                if (is_int($value) || is_float($value)) {
                    $rowsXml .= sprintf('<c r="%s" s="%d"><v>%s</v></c>', $ref, $style, $value);
                } elseif ($value === null || $value === '') {
                    $rowsXml .= sprintf('<c r="%s" s="%d"/>', $ref, $style);
                } else {
                    $rowsXml .= sprintf('<c r="%s" s="%d" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>', $ref, $style, htmlspecialchars((string) $value, ENT_QUOTES | ENT_XML1));
                }
            }
            $rowsXml .= '</row>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<sheetData>'.$rowsXml.'</sheetData>'
            .(count($merges) ? '<mergeCells count="'.count($merges).'">'.implode('', array_map(fn ($m) => '<mergeCell ref="'.$m.'"/>', $merges)).'</mergeCells>' : '')
            .'</worksheet>';
    }

    private static function colLetter(int $n): string
    {
        $s = '';
        while ($n > 0) {
            $n--;
            $s = chr(65 + $n % 26).$s;
            $n = intdiv($n, 26);
        }

        return $s;
    }

    private const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        .'<fonts count="3">'
        .'<font><sz val="10"/><name val="Calibri"/></font>'
        .'<font><b/><sz val="10"/><name val="Calibri"/></font>'
        .'<font><b/><sz val="12"/><name val="Calibri"/></font>'
        .'</fonts>'
        .'<fills count="3">'
        .'<fill><patternFill/></fill>'
        .'<fill><patternFill patternType="gray125"/></fill>'
        .'<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>'
        .'</fills>'
        .'<borders count="2">'
        .'<border><left/><right/><top/><bottom/><diagonal/></border>'
        .'<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>'
        .'</borders>'
        .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        .'<cellXfs count="7">'
        .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        .'<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        .'<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
        .'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>'
        .'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>'
        .'<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"/>'
        .'<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>'
        .'</cellXfs>'
        .'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        .'</styleSheet>';
}
