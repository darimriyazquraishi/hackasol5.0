using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace Lumi
{
    static class Program
    {
        private static Process _serverProcess = null;
        private static NotifyIcon _trayIcon = null;
        private static string _appUrl = "http://localhost:3000";
        private static string _baseDir = "";
        private static StreamWriter _logWriter = null;
        private static readonly object _logLock = new object();

        [STAThread]
        static void Main(string[] args)
        {
            _baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            string logPath = Path.Combine(_baseDir, "lumi.log");

            try
            {
                _logWriter = new StreamWriter(new FileStream(logPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite));
                _logWriter.AutoFlush = true;
            }
            catch { }

            Log("=================================================");
            Log("LUMI Desktop Launcher Starting - " + DateTime.Now.ToString("s"));
            Log("Base Directory: " + _baseDir);

            // 1. Singleton Check: Prevent multiple instances
            bool isNewInstance;
            using (Mutex mutex = new Mutex(true, "LUMI_SINGLETON_MUTEX_APP", out isNewInstance))
            {
                if (!isNewInstance)
                {
                    Log("Another instance of LUMI is already running. Opening browser...");
                    OpenBrowser(_appUrl);
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                // 2. Ensure Ollama service is running in background
                EnsureOllamaRunning();

                // 3. Start Node.js Production Backend Server
                StartNodeServer();

                // 4. Background task: Wait for server readiness then launch browser
                ThreadPool.QueueUserWorkItem(delegate
                {
                    bool ready = WaitForServerReady(15000);
                    Log("Server readiness status: " + ready);
                    OpenBrowser(_appUrl);

                    if (_trayIcon != null)
                    {
                        try
                        {
                            _trayIcon.ShowBalloonTip(3000, "LUMI Intelligence Workbench", "Running on " + _appUrl, ToolTipIcon.Info);
                        }
                        catch { }
                    }
                });

                // 5. Initialize System Tray Icon
                SetupTray();

                // 6. Hook process exit & run message loop
                AppDomain.CurrentDomain.ProcessExit += delegate { Shutdown(); };
                Application.ApplicationExit += delegate { Shutdown(); };

                Application.Run();
            }
        }

        private static void Log(string message)
        {
            try
            {
                lock (_logLock)
                {
                    if (_logWriter != null)
                    {
                        _logWriter.WriteLine("[" + DateTime.Now.ToString("HH:mm:ss") + "] " + message);
                    }
                }
            }
            catch { }
        }

        private static void EnsureOllamaRunning()
        {
            try
            {
                if (IsUrlResponsive("http://127.0.0.1:11434/api/tags", 1500))
                {
                    Log("Ollama service is already running on port 11434.");
                    return;
                }

                string ollamaPath = FindOllamaExecutable();
                if (!string.IsNullOrEmpty(ollamaPath) && File.Exists(ollamaPath))
                {
                    Log("Launching background Ollama service: " + ollamaPath);
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = ollamaPath;
                    psi.Arguments = "serve";
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.EnvironmentVariables["OLLAMA_KEEP_ALIVE"] = "-1";
                    psi.EnvironmentVariables["OLLAMA_ORIGINS"] = "*";
                    psi.EnvironmentVariables["OLLAMA_NUM_PARALLEL"] = "4";
                    psi.EnvironmentVariables["OLLAMA_MAX_LOADED_MODELS"] = "3";
                    psi.EnvironmentVariables["OLLAMA_FLASH_ATTENTION"] = "1";

                    Process.Start(psi);
                    Thread.Sleep(2000);
                }
                else
                {
                    Log("Ollama executable not detected in standard locations.");
                }
            }
            catch (Exception ex)
            {
                Log("Error while ensuring Ollama: " + ex.Message);
            }
        }

        private static string FindOllamaExecutable()
        {
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);

            string[] candidates = new string[]
            {
                Path.Combine(localApp, @"Programs\Ollama\ollama.exe"),
                Path.Combine(progFiles, @"Ollama\ollama.exe"),
                Path.Combine(localApp, @"Microsoft\WinGet\Packages\Ollama.Ollama.Portable_Microsoft.Winget.Source_8wekyb3d8bbwe\ollama.exe")
            };

            foreach (string path in candidates)
            {
                if (File.Exists(path)) return path;
            }

            // Search PATH
            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            string[] dirs = pathEnv.Split(';');
            foreach (string d in dirs)
            {
                try
                {
                    string candidate = Path.Combine(d.Trim(), "ollama.exe");
                    if (File.Exists(candidate)) return candidate;
                }
                catch { }
            }

            return null;
        }

        private static void StartNodeServer()
        {
            try
            {
                string nodePath = Path.Combine(_baseDir, "node.exe");
                if (!File.Exists(nodePath))
                {
                    nodePath = "node"; // Fallback to system PATH
                }

                string serverScript = Path.Combine(_baseDir, @"server\server.cjs");
                if (!File.Exists(serverScript))
                {
                    serverScript = Path.Combine(_baseDir, "server.cjs");
                }

                Log("Starting Node server: " + nodePath + " " + serverScript);

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodePath;
                psi.Arguments = "\"" + serverScript + "\"";
                psi.WorkingDirectory = _baseDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.EnvironmentVariables["NODE_ENV"] = "production";
                psi.EnvironmentVariables["PORT"] = "3000";
                psi.EnvironmentVariables["LUMI_MODEL_PATH"] = Path.Combine(_baseDir, "models");

                _serverProcess = new Process();
                _serverProcess.StartInfo = psi;

                _serverProcess.OutputDataReceived += delegate(object s, DataReceivedEventArgs e)
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        Log("[NODE OUT] " + e.Data);
                        if (e.Data.Contains("http://localhost:"))
                        {
                            int idx = e.Data.IndexOf("http://localhost:");
                            string sub = e.Data.Substring(idx);
                            string[] parts = sub.Split(new char[] { ' ', '\r', '\n', '\t' });
                            if (parts.Length > 0 && parts[0].StartsWith("http://localhost:"))
                            {
                                _appUrl = parts[0].TrimEnd('/');
                            }
                        }
                    }
                };

                _serverProcess.ErrorDataReceived += delegate(object s, DataReceivedEventArgs e)
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        Log("[NODE ERR] " + e.Data);
                    }
                };

                _serverProcess.Start();
                _serverProcess.BeginOutputReadLine();
                _serverProcess.BeginErrorReadLine();
                Log("Node server process started with PID: " + _serverProcess.Id);
            }
            catch (Exception ex)
            {
                Log("FATAL: Failed to start Node backend: " + ex.ToString());
                MessageBox.Show("Failed to launch LUMI backend:\n" + ex.Message, "LUMI Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static bool WaitForServerReady(int timeoutMs)
        {
            int elapsed = 0;
            int interval = 250;
            while (elapsed < timeoutMs)
            {
                if (IsUrlResponsive(_appUrl, 1000))
                {
                    return true;
                }
                Thread.Sleep(interval);
                elapsed += interval;
            }
            return false;
        }

        private static bool IsUrlResponsive(string url, int timeoutMs)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "GET";
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return ((int)resp.StatusCode >= 200 && (int)resp.StatusCode < 400);
                }
            }
            catch
            {
                return false;
            }
        }

        private static void OpenBrowser(string url)
        {
            try
            {
                Log("Opening browser to: " + url);
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = url;
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                Log("Failed to open browser: " + ex.Message);
            }
        }

        private static void SetupTray()
        {
            try
            {
                _trayIcon = new NotifyIcon();
                _trayIcon.Text = "LUMI Intelligence Workbench";

                string iconPath = Path.Combine(_baseDir, "lumi.ico");
                if (File.Exists(iconPath))
                {
                    _trayIcon.Icon = new Icon(iconPath);
                }
                else
                {
                    _trayIcon.Icon = SystemIcons.Application;
                }

                ContextMenu menu = new ContextMenu();

                MenuItem itemOpen = new MenuItem("Open LUMI in Browser", delegate { OpenBrowser(_appUrl); });
                itemOpen.DefaultItem = true;
                menu.MenuItems.Add(itemOpen);

                menu.MenuItems.Add(new MenuItem("Open Application Folder", delegate
                {
                    try { Process.Start("explorer.exe", _baseDir); } catch { }
                }));

                menu.MenuItems.Add(new MenuItem("View Server Logs", delegate
                {
                    try
                    {
                        string logFile = Path.Combine(_baseDir, "lumi.log");
                        if (File.Exists(logFile)) Process.Start("notepad.exe", logFile);
                    }
                    catch { }
                }));

                menu.MenuItems.Add("-");

                MenuItem itemExit = new MenuItem("Exit LUMI", delegate
                {
                    Shutdown();
                    Application.Exit();
                });
                menu.MenuItems.Add(itemExit);

                _trayIcon.ContextMenu = menu;
                _trayIcon.DoubleClick += delegate { OpenBrowser(_appUrl); };
                _trayIcon.Visible = true;
            }
            catch (Exception ex)
            {
                Log("Failed to setup system tray: " + ex.Message);
            }
        }

        private static void Shutdown()
        {
            Log("Shutdown requested. Cleaning up child processes...");
            if (_trayIcon != null)
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
                _trayIcon = null;
            }

            try
            {
                if (_serverProcess != null && !_serverProcess.HasExited)
                {
                    Log("Terminating Node server process tree...");
                    KillProcessTree(_serverProcess.Id);
                    _serverProcess = null;
                }
            }
            catch { }

            Log("Shutdown complete.");
            if (_logWriter != null)
            {
                try { _logWriter.Close(); } catch { }
            }
        }

        private static void KillProcessTree(int pid)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "taskkill";
                psi.Arguments = "/F /T /PID " + pid;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(3000);
                }
            }
            catch { }
        }
    }
}
