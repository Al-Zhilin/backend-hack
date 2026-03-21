$body = @{
    login = "valeria_yatsuk"
    text  = "Хочу в тур по Краснодару на 2 дня, нас будет двое"
} | ConvertTo-Json -Depth 10

$client = [System.Net.Http.HttpClient]::new()

$content = [System.Net.Http.StringContent]::new(
    $body,
    [System.Text.Encoding]::UTF8,
    "application/json"
)

$response = $client.PostAsync(
    "http://localhost:8000/api/chat",
    $content,
    [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead
).GetAwaiter().GetResult()

$stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
$reader = [System.IO.StreamReader]::new($stream)

while (-not $reader.EndOfStream) {
    $line = $reader.ReadLine()
    if ($line -ne $null -and $line.Trim() -ne "") {
        Write-Host $line
    }
}