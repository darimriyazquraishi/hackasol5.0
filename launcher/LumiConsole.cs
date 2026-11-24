using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

namespace LumiConsole
{
    class Program
    {
        private static Process _serverProcess = null;
        private static string _appUrl = "http://localhost:3000";
        private static string _baseDir = "";

        static void Main(string[] args)
        {
            _baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');

            Console.Title = "LUMI Intelligence Workbench — Live Console";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("===============================================================");
            Console.WriteLine("    LUMI — Local Unified Multimodal Intelligence Workbench     ");
            Console.WriteLine("===============================================================");
            Console.ResetColor();

            Console.WriteLine("[LUMI] Directory: " + _baseDir);

            // 1. Ensure Ollama service
            Console.Write("[LUMI] Checking local Ollama service... ");
            if (IsUrlResponsive("http://127.0.0.1:11434/api/tags", 1500))
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("Running (Port 11434)");
                Console.ResetColor();
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("Starting in background...");
                Console.ResetColor();
                StartOllamaService();
            }

            // 2. Start Node server
            Console.WriteLine("[LUMI] Starting Node.js production server...");
            StartNodeServer();

            // 3. Open browser
            ThreadPool.QueueUserWorkItem(delegate
            {
                bool ready = WaitForServerReady(15000);
                if (ready)
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("[LUMI] Production server ready at " + _appUrl);
                    Console.ResetColor();
                    OpenBrowser(_appUrl);
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("[LUMI] Timed out waiting for server, opening browser anyway...");
                    Console.ResetColor();
                    OpenBrowser(_appUrl);
                }
            });

            // 4. Handle exit
            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs e)
            {
                Console.WriteLine("\n[LUMI] Shutting down...");
                Shutdown();
            };

            Console.WriteLine("[LUMI] Press Ctrl+C at any time to stop LUMI.");
            Console.WriteLine("---------------------------------------------------------------");

            if (_serverProcess != null)
            {
                _serverProcess.WaitForExit();
            }
        }

        private static void StartOllamaService()
        {
            try
            {
                string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);

                string[] candidates = new string[]
                {
                    Path.Combine(localApp, @"Programs\Ollama\ollama.exe"),
                    Path.Combine(progFiles, @"Ollama\ollama.exe"),
                    Path.Combine(localApp, @"Microsoft\WinGet\Packages\Ollama.Ollama.Portable_Microsoft.Winget.Source_8wekyb3d8bbwe\ollama.exe")
                };

                string ollamaPath = null;
                foreach (string path in candidates)
                {
                    if (File.Exists(path)) { ollamaPath = path; break; }
                }

                if (string.IsNullOrEmpty(ollamaPath)) ollamaPath = "ollama";

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = ollamaPath;
                psi.Arguments = "serve";
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.EnvironmentVariables["OLLAMA_KEEP_ALIVE"] = "-1";
                psi.EnvironmentVariables["OLLAMA_ORIGINS"] = "*";
                Process.Start(psi);
                Thread.Sleep(2000);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[LUMI] Ollama check note: " + ex.Message);
            }
        }

        private static void StartNodeServer()
        {
            try
            {
                string nodePath = Path.Combine(_baseDir, "node.exe");
                if (!File.Exists(nodePath)) nodePath = "node";

                string serverScript = Path.Combine(_baseDir, @"server\server.cjs");
                if (!File.Exists(serverScript)) serverScript = Path.Combine(_baseDir, "server.cjs");

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodePath;
                psi.Arguments = "\"" + serverScript + "\"";
                psi.WorkingDirectory = _baseDir;
                psi.CreateNoWindow = false;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.EnvironmentVariables["NODE_ENV"] = "production";
                psi.EnvironmentVariables["PORT"] = "3000";

                _serverProcess = new Process();
                _serverProcess.StartInfo = psi;

                _serverProcess.OutputDataReceived += delegate(object s, DataReceivedEventArgs e)
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        Console.WriteLine(e.Data);
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
                        Console.ForegroundColor = ConsoleColor.DarkRed;
                        Console.WriteLine("[ERROR] " + e.Data);
                        Console.ResetColor();
                    }
                };

                _serverProcess.Start();
                _serverProcess.BeginOutputReadLine();
                _serverProcess.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[FATAL ERROR] " + ex.Message);
                Console.ResetColor();
            }
        }

        private static bool WaitForServerReady(int timeoutMs)
        {
            int elapsed = 0;
            int interval = 250;
            while (elapsed < timeoutMs)
            {
                if (IsUrlResponsive(_appUrl, 1000)) return true;
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
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return ((int)resp.StatusCode >= 200 && (int)resp.StatusCode < 400);
                }
            }
            catch { return false; }
        }

        private static void OpenBrowser(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch { }
        }

        private static void Shutdown()
        {
            try
            {
                if (_serverProcess != null && !_serverProcess.HasExited)
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "taskkill";
                    psi.Arguments = "/F /T /PID " + _serverProcess.Id;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    using (Process p = Process.Start(psi))
                    {
                        p.WaitForExit(3000);
                    }
                }
            }
            catch { }
        }
    }
}
