$filePath = "e:\web\wedhub-main (1)\wedhub-main\src\components\EventManagement.tsx"
$lines = Get-Content $filePath
$part1 = $lines[0..624]
$part2 = $lines[1376..1732]
$combined = $part1 + '' + '' + $part2
$combined | Set-Content $filePath -Encoding UTF8
Write-Host "Done. New line count: $($combined.Count)"
