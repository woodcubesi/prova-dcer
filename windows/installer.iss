#define AppVersion "1.1.0"
#ifndef PayloadPath
  #define PayloadPath "..\build\windows\payload"
#endif

[Setup]
AppId={{8F2B6CDE-2259-464C-A540-69B59CFC87C1}
AppName=Provas DCER Paulista
AppVersion={#AppVersion}
AppPublisher=Josue Sampaio Lopes Coutinho
AppPublisherURL=https://github.com/woodcubesi/prova-dcer
DefaultDirName={autopf}\Provas DCER
UsePreviousAppDir=no
DefaultGroupName=Provas DCER Paulista
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.22000
OutputDir=..\dist
OutputBaseFilename=Provas-DCER-{#AppVersion}-windows-x64-setup
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
UninstallDisplayName=Provas DCER Paulista
SetupLogging=yes
CloseApplications=no
InfoBeforeFile=README-INSTALL.txt

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "{#PayloadPath}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\data"; Flags: uninsneveruninstall

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na area de trabalho"; Flags: unchecked

[Icons]
Name: "{group}\Provas DCER Paulista"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\windows\Open-DCER.ps1"""; WorkingDir: "{app}"
Name: "{group}\Gerenciar servico Windows"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\windows\Open-DCER.ps1"" -ManageService"; WorkingDir: "{app}"
Name: "{group}\Pasta da instalacao"; Filename: "{app}"
Name: "{autodesktop}\Provas DCER Paulista"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\windows\Open-DCER.ps1"""; WorkingDir: "{app}"; Tasks: desktopicon

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\windows\Configure-Service.ps1"" -Uninstall"; Flags: runhidden waituntilterminated

[Code]
var
  Options: TInputQueryWizardPage;
  Credentials: TInputQueryWizardPage;

function HexCodeUnit(Code: Integer): String;
var
  Digits: String;
  Index: Integer;
begin
  Digits := '0123456789abcdef';
  Result := '';
  for Index := 1 to 4 do begin
    Result := Copy(Digits, (Code mod 16) + 1, 1) + Result;
    Code := Code div 16;
  end;
end;

function JsonEscape(Value: String): String;
var
  Index, Code: Integer;
begin
  Result := '';
  for Index := 1 to Length(Value) do begin
    Code := Ord(Value[Index]);
    if Value[Index] = '\' then Result := Result + '\\'
    else if Value[Index] = '"' then Result := Result + '\"'
    else if (Code < 32) or (Code > 126) then Result := Result + '\u' + HexCodeUnit(Code)
    else Result := Result + Value[Index];
  end;
end;

function CreatePasswordHash(Password: String): String;
var
  Shell, Process: Variant;
  Attempts: Integer;
begin
  Shell := CreateOleObject('WScript.Shell');
  Process := Shell.Exec('"' + ExpandConstant('{app}\node\node.exe') + '" "' +
    ExpandConstant('{app}\windows\crypto.cjs') + '" hash-stdin');
  Process.StdIn.WriteLine('{"password":"' + JsonEscape(Password) + '"}');
  Process.StdIn.Close;
  Attempts := 0;
  while Process.Status = 0 do begin
    Sleep(25);
    Attempts := Attempts + 1;
    if Attempts > 1200 then begin
      Process.Terminate;
      RaiseException('Tempo esgotado ao proteger a senha inicial.');
    end;
  end;
  if Process.ExitCode <> 0 then RaiseException('Nao foi possivel proteger a senha inicial.');
  Result := Process.StdOut.ReadAll;
  Result := Trim(Result);
  if (Length(Result) <> 168) or (Copy(Result, 1, 7) <> 'scrypt:') then
    RaiseException('Resultado invalido ao proteger a senha inicial.');
end;

procedure InitializeWizard;
begin
  Options := CreateInputQueryPage(wpSelectDir, 'Configuracao do Provas DCER',
    'Escolha a porta e o primeiro administrador',
    'Defina a conta de acesso ao painel. Contas existentes nao serao alteradas. ' +
    'O servico Windows iniciara automaticamente. Um certificado exclusivo de localhost sera confiado neste computador.');
  Options.Add('Porta HTTPS da aplicacao (1024 a 65535):', False);
  Options.Add('Nome do primeiro administrador:', False);
  Options.Add('E-mail do primeiro administrador:', False);
  Options.Values[0] := ExpandConstant('{param:PORT|3443}');
  Options.Values[1] := ExpandConstant('{param:ADMINNAME|Administrador}');
  Options.Values[2] := ExpandConstant('{param:ADMINEMAIL|admin@dcer.local}');
  Credentials := CreateInputQueryPage(Options.ID, 'Senha do administrador inicial',
    'Defina a senha de acesso ao painel',
    'Esta senha e do painel Provas DCER, nao da conta Windows do servico. ' +
    'Em uma atualizacao, a senha de administradores existentes sera preservada.');
  Credentials.Add('Senha do primeiro administrador (8 a 120 caracteres):', True);
  Credentials.Add('Confirme a senha:', True);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Port: Integer;
begin
  Result := True;
  if CurPageID = Options.ID then begin
    Port := StrToIntDef(Trim(Options.Values[0]), 0);
    if (Port < 1024) or (Port > 65535) then begin
      MsgBox('Informe uma porta entre 1024 e 65535.', mbError, MB_OK);
      Result := False;
    end else if (Length(Trim(Options.Values[1])) < 3) or
      (Pos('@', Options.Values[2]) < 2) or (Pos('.', Options.Values[2]) < 3) then begin
      MsgBox('Informe o nome e um e-mail valido para o administrador.', mbError, MB_OK);
      Result := False;
    end;
  end;
  if CurPageID = Credentials.ID then begin
    if (Length(Credentials.Values[0]) < 8) or (Length(Credentials.Values[0]) > 120) then begin
      MsgBox('A senha inicial deve ter entre 8 e 120 caracteres.', mbError, MB_OK);
      Result := False;
    end else if Credentials.Values[0] <> Credentials.Values[1] then begin
      MsgBox('As senhas nao conferem.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
  ScriptFile: String;
begin
  Result := '';
  if not NextButtonClick(Options.ID) or not NextButtonClick(Credentials.ID) then begin
    Result := 'Configuracao invalida.';
    Exit;
  end;
  ScriptFile := ExpandConstant('{app}\windows\Configure-Service.ps1');
  if FileExists(ScriptFile) then begin
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptFile + '" -Stop', '', SW_HIDE,
      ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) then
      Result := 'Nao foi possivel encerrar a versao existente.';
  end;
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -Command "try { $l=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,' +
    Options.Values[0] + '); $l.Start(); $l.Stop(); exit 0 } catch { exit 1 }"', '', SW_HIDE,
    ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) then
    Result := 'A porta escolhida esta ocupada. Volte e escolha outra porta.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ExitCode: Integer;
  Bootstrap: String;
  PasswordHash: String;
  BootstrapLines: TArrayOfString;
begin
  if CurStep = ssPostInstall then begin
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\windows\Configure-Service.ps1') +
      '" -PrepareData', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) then
      RaiseException('Nao foi possivel proteger a pasta de configuracao inicial.');
    PasswordHash := CreatePasswordHash(Credentials.Values[0]);
    Credentials.Values[0] := '';
    Credentials.Values[1] := '';
    Bootstrap := '{"name":"' + JsonEscape(Trim(Options.Values[1])) + '","email":"' +
      JsonEscape(Lowercase(Trim(Options.Values[2]))) + '","publicPort":' + Trim(Options.Values[0]) +
      ',"passwordHash":"' + PasswordHash + '"}';
    SetArrayLength(BootstrapLines, 1);
    BootstrapLines[0] := Bootstrap;
    if not SaveStringsToUTF8File(ExpandConstant('{app}\data\bootstrap.json'), BootstrapLines, False) then
      RaiseException('Nao foi possivel salvar a configuracao inicial.');
    if ExpandConstant('{param:NOINIT|0}') <> '1' then begin
      if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
        '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\windows\Configure-Service.ps1') +
        '" -Install -PublicPort ' + Options.Values[0], '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) then
        RaiseException('Falha no servico. Consulte a subpasta data\logs da instalacao.');
    end;
  end;
end;

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\windows\Open-DCER.ps1"""; Description: "Abrir Provas DCER Paulista"; Flags: postinstall skipifsilent nowait runasoriginaluser runhidden
