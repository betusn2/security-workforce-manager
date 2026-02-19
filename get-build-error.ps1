$secret = '{"id":"64174a0d-e430-4a04-9e59-060d1787559a","version":1,"expires_at":2086905600000}'
$headers = @{"expo-session"=$secret;"Content-Type"="application/json"}

# First get schema to find correct field names
$schemaBody = '{"query":"{ __schema { queryType { fields { name description } } } }"}'
try {
    $resp = Invoke-RestMethod -Uri "https://api.expo.dev/graphql" -Method POST -Headers $headers -Body $schemaBody
    $resp.data.__schema.queryType.fields | Where-Object { $_.name -match "build" } | Format-Table
} catch {
    $stream = $_.Exception.Response.Content.ReadAsStringAsync().Result
    Write-Host "Schema error: $stream"
}
