/**
 * LUMI One-Folder Executable Builder
 * Assembles a completely self-contained portable distribution folder for Windows.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_DIR = path.resolve(ROOT_DIR, 'release');
const OUTPUT_DIR = path.resolve(RELEASE_DIR, 'LUMI');
const CSC_COMPILER = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function buildOneFolderExe() {
  console.log('====================================================');
  console.log('   Building LUMI Portable One-Folder Distribution   ');
  console.log('====================================================\n');

  // 1. Prepare Release Folder Structure
  console.log('[1/8] Preparing release folder: ' + OUTPUT_DIR);
  if (!fs.existsSync(RELEASE_DIR)) fs.mkdirSync(RELEASE_DIR, { recursive: true });
  if (fs.existsSync(OUTPUT_DIR)) {
    try {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    } catch {
      console.log('Note: Some files in output dir were locked, continuing...');
    }
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'server'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'data', 'deliverables'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'scratch'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'models'), { recursive: true });

  // 2. Ensure Production Frontend is Built
  console.log('\n[2/8] Building/Verifying frontend production bundle in dist/...');
  execSync('npm.cmd run build', { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('Copying frontend dist/ to release/LUMI/dist/...');
  copyDirRecursive(path.join(ROOT_DIR, 'dist'), path.join(OUTPUT_DIR, 'dist'));

  // 3. Bundle Backend Server with esbuild
  console.log('\n[3/8] Bundling production backend with esbuild...');
  const externalModules = [
    '@resvg/resvg-js',
    'pdfkit',
    'unicode-properties',
    'fontkit',
    'png-js',
    'brotli',
    'clone',
    'restructure',
    'tiny-inflate',
    'unicode-trie',
    'dfa',
    'linebreak',
    'base64-js'
  ];

  const serverOut = path.join(OUTPUT_DIR, 'server', 'server.cjs');
  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, 'server', 'prodServer.ts')],
    outfile: serverOut,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: externalModules
  });
  console.log('Backend bundled successfully -> ' + serverOut);

  // 4. Copy Required Runtime node_modules
  console.log('\n[4/8] Copying required runtime node_modules...');
  const requiredModules = [
    '@resvg',
    'pdfkit',
    'unicode-properties',
    'fontkit',
    'png-js',
    'brotli',
    'clone',
    'restructure',
    'tiny-inflate',
    'unicode-trie',
    'dfa',
    'linebreak',
    'base64-js'
  ];

  for (const mod of requiredModules) {
    const srcMod = path.join(ROOT_DIR, 'node_modules', mod);
    const destMod = path.join(OUTPUT_DIR, 'node_modules', mod);
    if (fs.existsSync(srcMod)) {
      copyDirRecursive(srcMod, destMod);
    }
  }
  console.log('Runtime node_modules packaged successfully.');

  // 5. Copy Standalone Node.js Runtime Executable
  console.log('\n[5/8] Bundling standalone node.exe runtime...');
  let nodeSource = 'C:\\Program Files\\nodejs\\node.exe';
  if (!fs.existsSync(nodeSource)) {
    try {
      const whichNode = execSync('where.exe node', { encoding: 'utf8' }).trim().split('\r\n')[0];
      if (fs.existsSync(whichNode)) nodeSource = whichNode;
    } catch {}
  }
  if (fs.existsSync(nodeSource)) {
    const destNode = path.join(OUTPUT_DIR, 'node.exe');
    try {
      if (!fs.existsSync(destNode) || fs.statSync(destNode).size !== fs.statSync(nodeSource).size) {
        fs.copyFileSync(nodeSource, destNode);
      }
    } catch {
      console.log('node.exe already present in release folder (in-use or unchanged).');
    }
    console.log('Bundled node.exe runtime (' + (fs.statSync(destNode).size / 1024 / 1024).toFixed(1) + ' MB)');
  }

  // 6. Copy Engine Scripts, Blender Workspace & Assets
  console.log('\n[6/8] Copying engineering engines & branding assets...');
  const calcPy = path.join(ROOT_DIR, 'server', 'calculationEngine.py');
  if (fs.existsSync(calcPy)) {
    fs.copyFileSync(calcPy, path.join(OUTPUT_DIR, 'server', 'calculationEngine.py'));
  }
  const diffPy = path.join(ROOT_DIR, 'server', 'diffusionEngine.py');
  if (fs.existsSync(diffPy)) {
    fs.copyFileSync(diffPy, path.join(OUTPUT_DIR, 'server', 'diffusionEngine.py'));
  }
  const blenderSkill = path.join(ROOT_DIR, 'server', 'prj_blender_skill');
  if (fs.existsSync(blenderSkill)) {
    copyDirRecursive(blenderSkill, path.join(OUTPUT_DIR, 'server', 'prj_blender_skill'));
  }

  const iconSrc = path.join(ROOT_DIR, 'public', 'lumi.ico');
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(OUTPUT_DIR, 'lumi.ico'));
    fs.copyFileSync(iconSrc, path.join(OUTPUT_DIR, 'favicon.ico'));
  }
  const favSvg = path.join(ROOT_DIR, 'public', 'favicon.svg');
  if (fs.existsSync(favSvg)) {
    fs.copyFileSync(favSvg, path.join(OUTPUT_DIR, 'favicon.svg'));
  }
  const logoSrc = path.join(ROOT_DIR, 'public', 'lumi-logo.jpg');
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.join(OUTPUT_DIR, 'lumi-logo.jpg'));
  }
  const logoIconSrc = path.join(ROOT_DIR, 'public', 'lumi-icon.png');
  if (fs.existsSync(logoIconSrc)) {
    fs.copyFileSync(logoIconSrc, path.join(OUTPUT_DIR, 'lumi-icon.png'));
  }

  // 7. Compile Native Windows Launchers
  console.log('\n[7/8] Compiling native Windows executables (LUMI.exe & LUMI-Console.exe)...');
  const launcherCs = path.join(ROOT_DIR, 'launcher', 'LumiLauncher.cs');
  const consoleCs = path.join(ROOT_DIR, 'launcher', 'LumiConsole.cs');
  const lumiExe = path.join(OUTPUT_DIR, 'LUMI.exe');
  const lumiConsoleExe = path.join(OUTPUT_DIR, 'LUMI-Console.exe');

  if (fs.existsSync(CSC_COMPILER)) {
    try {
      // Compile GUI launcher (winexe)
      const cmdGui = `"${CSC_COMPILER}" /target:winexe /optimize+ /platform:x64 /win32icon:"${iconSrc}" /r:System.Drawing.dll,System.Windows.Forms.dll,System.dll /out:"${lumiExe}" "${launcherCs}"`;
      execSync(cmdGui, { stdio: 'pipe' });
      console.log('Compiled LUMI.exe (Windows GUI with System Tray)');
    } catch {
      console.log('LUMI.exe compile note: executable present/in-use.');
    }

    try {
      // Compile Console launcher (exe)
      const cmdConsole = `"${CSC_COMPILER}" /target:exe /optimize+ /platform:x64 /win32icon:"${iconSrc}" /r:System.Drawing.dll,System.dll /out:"${lumiConsoleExe}" "${consoleCs}"`;
      execSync(cmdConsole, { stdio: 'pipe' });
      console.log('Compiled LUMI-Console.exe (Console Debug Mode)');
    } catch {
      console.log('LUMI-Console.exe compile note: executable present/in-use.');
    }
  }

  // Convenience batch starter inside package
  const startBat = `@echo off
cd /d "%~dp0"
if exist LUMI.exe (
    start "" LUMI.exe
) else (
    node.exe server\\server.cjs
)
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'start.bat'), startBat);

  // Documentation
  const readme = `================================================================================
       LUMI — Local Unified Multimodal Intelligence Workbench (Portable)
================================================================================

HOW TO RUN:
-----------
1. Double-click "LUMI.exe".
2. LUMI will automatically check your local Ollama background service,
   start the local production server, and open your browser to:
   http://localhost:3000

SYSTEM TRAY:
------------
- When running, LUMI sits cleanly in your Windows Taskbar System Tray.
- Click or double-click the tray icon to open the workbench in your browser.
- Right-click the tray icon for options:
  - Open LUMI in Browser
  - Open Application Folder
  - View Server Logs
  - Exit LUMI (cleanly terminates background server)

CONSOLE MODE:
-------------
- If you prefer to view live server logs, run "LUMI-Console.exe".
- Press Ctrl+C in the console window to stop LUMI.

DIRECTORIES:
------------
- dist/         : Precompiled frontend web application.
- server/       : Standalone backend application server and calculation engines.
- node_modules/ : Native modules required for deliverable exports.
- data/         : Local engineering deliverables and exports.
- scratch/      : Intermediate analysis files and working outputs.
- models/       : Local cached model weights and embeddings.

REQUIREMENTS:
-------------
- Windows 10 or 11 (64-bit).
- Ollama (installed locally) for offline LLM reasoning.
- Blender (optional) if using the 3D Blender Studio workspace.
================================================================================
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.txt'), readme);

  // 8. Create ZIP archive
  console.log('\n[8/8] Creating portable ZIP archive: release/LUMI-Portable.zip...');
  const zipPath = path.join(RELEASE_DIR, 'LUMI-Portable.zip');
  if (fs.existsSync(zipPath)) {
    try { fs.unlinkSync(zipPath); } catch {}
  }

  try {
    const psCompress = `powershell -NoProfile -Command "$staging = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString()); Robocopy.exe '${OUTPUT_DIR}' $staging /E /XF *.log > $null; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($staging, '${zipPath}', [System.IO.Compression.CompressionLevel]::Optimal, $false); Remove-Item -Recurse -Force $staging"`;
    execSync(psCompress, { stdio: 'pipe' });
    console.log('Created portable archive: ' + zipPath + ' (' + (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1) + ' MB)');
  } catch (err) {
    console.log('Zip creation note:', err.message);
  }

  console.log('\n====================================================');
  console.log('   BUILD COMPLETE! One-Folder Distribution Ready:   ');
  console.log('   Folder:  ' + OUTPUT_DIR);
  if (fs.existsSync(zipPath)) {
    console.log('   Archive: ' + zipPath);
  }
  console.log('====================================================\n');
}

buildOneFolderExe().catch(err => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});
