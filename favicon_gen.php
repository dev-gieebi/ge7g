<?php
$src = 'frontendWeb/public/logo-ge7g.png';
$dst = 'frontendWeb/public/favicon.ico';

if (!file_exists($src)) {
    echo "Source image not found: $src\n";
    exit(1);
}

$im = imagecreatefrompng($src);
imagealphablending($im, false);
imagesavealpha($im, true);
$size = 32;
$scaled = imagescale($im, $size, $size, IMG_BICUBIC);
imagedestroy($im);

ob_start();
imagepng($scaled);
$png = ob_get_clean();
imagedestroy($scaled);

$colorPlanes = 1;
$bitsPerPixel = 32;
$header = pack('S3', 0, 1, 1); // Reserved, Type icon, Count
$entry = pack('CCCCS2V2',
    $size,
    $size,
    0,        // Colors in palette
    0,        // Reserved
    $colorPlanes,
    $bitsPerPixel,
    strlen($png),
    22        // Offset to image data
);

file_put_contents($dst, $header . $entry . $png);
echo "Favicon created: $dst\n";
