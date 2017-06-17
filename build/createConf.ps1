If (Test-Path env:APPVEYOR_PULL_REQUEST_NUMBER) 
{
    Copy-Item build\conf.ts.default app\utils\conf.ts
}
Else 
{
    nuget install secure-file -ExcludeVersion
    echo $env:SECRET_FILE_KEY
    .\secure-file\tools\secure-file.exe -decrypt build\conf.ts.win.enc -secret $env:SECRET_FILE_KEY -out app\utils\conf.ts
}
