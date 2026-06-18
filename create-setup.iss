; ================================
; NES Emulator Setup Script
; ================================

#define MyAppName "NES Emulator"
#define MyAppVersion GetEnv("npm_package_version")
#define MyAppPublisher "Jonas Grimm"
#define MyAppURL "https://jonasgrimm.de"
#define MyAppExeName "NES Emulator.exe"

[Setup]
AppId={{A31C1B42-7440-4E41-8CB7-6326EC0C184F}
AppName={#MyAppName}
AppVerName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
AppCopyright=Copyright (c) 2026 {#MyAppPublisher}

DefaultDirName={userappdata}\jonasgrimm.de\NES Emulator
UsePreviousAppDir=no
DisableDirPage=yes
DisableProgramGroupPage=yes
DirExistsWarning=no

UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
Uninstallable=yes

OutputDir=dist\installer
OutputBaseFilename=NES-Emulator-Setup-{#MyAppVersion}
SetupIconFile=build\icons\app.ico
VersionInfoVersion={#MyAppVersion}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Installer
VersionInfoCopyright=Copyright (c) 2026 {#MyAppPublisher}

ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern dark
SolidCompression=no
Compression=zip
InternalCompressLevel=normal

PrivilegesRequired=lowest
AppMutex=NESEmulatorAppMutex
SetupMutex=NESEmulatorSetupMutex
ChangesAssociations=no
DisableWelcomePage=no
DisableReadyPage=no
DisableFinishedPage=no
AlwaysShowDirOnReadyPage=no
ShowLanguageDialog=no
UsePreviousTasks=yes
CloseApplications=yes
RestartApplications=yes
CloseApplicationsFilter={#MyAppExeName}
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons"; Flags: unchecked

[Files]
Source: "dist\win-unpacked\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; Excludes: "*.pdb,*.map,Thumbs.db,desktop.ini"

[Dirs]
Name: "{app}\Games"
Name: "{app}\Saves"
Name: "{app}\User Data"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Start {#MyAppName} now"; Flags: nowait postinstall

[Code]
procedure TryRemoveDirIfEmpty(const DirName: string);
begin
  if DirExists(DirName) then
  begin
    RemoveDir(DirName);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    TryRemoveDirIfEmpty(ExpandConstant('{userappdata}\jonasgrimm.de'));
  end;
end;
