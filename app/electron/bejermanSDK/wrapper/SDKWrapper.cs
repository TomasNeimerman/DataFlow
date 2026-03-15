/**
 * SDKWrapper - Puente entre DataFlow (Node.js/Electron) y las DLLs del SDK de Bejerman
 *
 * Uso:
 *   SDKWrapper.exe --empresa MODE --usuario ADMIN --pto-trabajo 1 --json-file C:\temp\recibo.json
 *   SDKWrapper.exe --empresa MODE --usuario ADMIN --pto-trabajo 1 --circuito VENTAS --operacion IngresarComprobanteJSON --numera S --emite E --json-file recibo.json
 *
 * Salida (stdout): JSON con resultado
 *   {"success":true,"message":"Comprobante ingresado correctamente"}
 *   {"success":false,"message":"Error al ingresar","errors":"Detalle del error"}
 *
 * Exit codes: 0=OK, 1=Error SDK, 2=Error argumentos
 *
 * Referencia: SDK_TestForms/Form1.cs (Tester oficial de Bejerman)
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using SB.NET.eFlex.SDKLib;
using SB.NET.eFlex.SDKLib.Comprobantes;

namespace DataFlow.SDKWrapper
{
    class Program
    {
        [System.STAThread]
        static int Main(string[] args)
        {
            Console.OutputEncoding = System.Text.Encoding.UTF8;

            // Parsear argumentos
            var config = ParseArgs(args);
            if (config == null)
            {
                WriteOutput(false, "Argumentos inválidos. Uso: SDKWrapper.exe --empresa X --usuario X --clave X --pto-trabajo X --json-file X [--circuito VENTAS] [--operacion IngresarComprobanteJSON] [--numera S] [--emite E]", null);
                return 2;
            }

            // Validar archivo JSON
            if (!File.Exists(config["json-file"]))
            {
                WriteOutput(false, "Archivo JSON no encontrado: " + config["json-file"], null);
                return 2;
            }

            // Leer JSON
            string jsonData;
            try
            {
                jsonData = File.ReadAllText(config["json-file"], System.Text.Encoding.UTF8);
            }
            catch (Exception ex)
            {
                WriteOutput(false, "Error al leer archivo JSON: " + ex.Message, null);
                return 2;
            }

            if (string.IsNullOrWhiteSpace(jsonData))
            {
                WriteOutput(false, "Archivo JSON vacío", null);
                return 2;
            }

            // Ejecutar operación SDK
            dynamic procesos = CrearProcesoCollection();
            if (procesos == null)
            {
                WriteOutput(false, "No se pudo cargar EFlexSDK_ProcesoCollection desde las DLLs", null);
                return 1;
            }
            dynamic token = null;
            try
            {
                // 1. Iniciar proceso (login)
                LogDebug("Iniciando proceso SDK...");
                token = procesos.IniciarProcesoFlex(
                    config["usuario"],
                    config["clave"]
                );

                if (token == null)
                {
                    WriteOutput(false, "No se pudo obtener el token de autenticación", null);
                    return 1;
                }
                LogDebug("Token obtenido OK");

                // 2. Abrir empresa
                LogDebug("Abriendo empresa " + config["empresa"] + "...");
                bool empresaAbierta = procesos.AbrirEmpresaFlex(
                    config["empresa"],
                    config["pto-trabajo"],
                    token
                );
                LogDebug("AbrirEmpresaFlex retornó: " + empresaAbierta);
                if (!empresaAbierta)
                {
                    WriteOutput(false, "No se pudo abrir la empresa '" + config["empresa"] + "'. Verifique código de empresa y punto de trabajo.", null);
                    return 1;
                }
                LogDebug("Empresa abierta OK");

                // 3. Registrar aplicación SDK (COM interop)
                LogDebug("Registrando aplicación SDK...");
                try
                {
                    Type tipoImportador = Type.GetTypeFromProgID("WfrCVSVR.ImportacionCVSDK");
                    if (tipoImportador != null)
                    {
                        dynamic importador = Activator.CreateInstance(tipoImportador);
                        procesos.HabilitarInfoDebug();
                        string nuevoValor = importador.RegistraAplicacionSDK(token.Valor);
                        LogDebug("RegistraAplicacionSDK retornó: [" + (nuevoValor ?? "NULL") + "]");
                        // NO actualizamos token.Valor: AbrirEmpresaFlex registra el ProcesoFlex
                        // con el valor original del token. Si lo cambiamos, EFlexSDK_Ventas
                        // no encuentra el contexto y _ProcFlex queda null → NullReferenceException.
                        LogDebug("Aplicación SDK registrada OK. token.Valor (sin cambiar)=[" + (token.Valor ?? "NULL") + "]");
                    }
                    else
                    {
                        LogDebug("ADVERTENCIA: COM class WfrCVSVR.ImportacionCVSDK no encontrada, continuando sin registro");
                    }
                }
                catch (Exception exCom)
                {
                    LogDebug("ADVERTENCIA: Error registrando COM: " + exCom.Message + ". Continuando sin registro.");
                }

                // 4. Ejecutar operación según circuito
                string circuito = config.ContainsKey("circuito") ? config["circuito"].ToUpper() : "VENTAS";
                string operacion = config.ContainsKey("operacion") ? config["operacion"] : "IngresarComprobanteJSON";
                string numera = config.ContainsKey("numera") ? config["numera"] : "S";
                string emite = config.ContainsKey("emite") ? config["emite"] : "E";

                LogDebug("Ejecutando " + circuito + "/" + operacion + " (numera=" + numera + ", emite=" + emite + ")...");

                string resultado = EjecutarOperacion(circuito, operacion, jsonData, numera, emite, token, procesos);

                if (!string.IsNullOrEmpty(resultado))
                {
                    WriteOutput(false, "Error al procesar comprobante", resultado);
                    return 1;
                }

                WriteOutput(true, "Comprobante ingresado correctamente", null);
                return 0;
            }
            catch (EFlexSDK_Exception exSdk)
            {
                WriteOutput(false, "Error SDK: " + exSdk.Message, exSdk.ToString());
                return 1;
            }
            catch (Exception ex)
            {
                WriteOutput(false, "Error inesperado: " + ex.Message, ex.ToString());
                return 1;
            }
            finally
            {
                // 5. Cerrar proceso siempre
                if (token != null)
                {
                    try
                    {
                        LogDebug("Cerrando proceso SDK...");
                        procesos.CerrarProcesoFlex(token);
                        LogDebug("Proceso cerrado OK");
                    }
                    catch (Exception exClose)
                    {
                        LogDebug("Error al cerrar proceso: " + exClose.Message);
                    }
                }
            }
        }

        /// <summary>
        /// Carga EFlexSDK_ProcesoCollection dinámicamente iterando las DLLs del directorio del EXE.
        /// Evita la referencia estática al tipo que causa CS0246 si la DLL no está en el compilador.
        /// </summary>
        static dynamic CrearProcesoCollection()
        {
            string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            foreach (string dllPath in Directory.GetFiles(exeDir, "*.dll"))
            {
                try
                {
                    Assembly asm = Assembly.LoadFrom(dllPath);
                    Type[] types;
                    try { types = asm.GetTypes(); }
                    catch (ReflectionTypeLoadException rtle) { types = rtle.Types ?? new Type[0]; }
                    foreach (Type t in types)
                    {
                        if (t != null && t.Name == "EFlexSDK_ProcesoCollection")
                        {
                            LogDebug("EFlexSDK_ProcesoCollection encontrado en: " + Path.GetFileName(dllPath));
                            return Activator.CreateInstance(t);
                        }
                    }
                }
                catch { /* DLL no cargable, continuar */ }
            }
            return null;
        }

        /// <summary>
        /// Ejecuta la operación SDK según el circuito
        /// </summary>
        static string EjecutarOperacion(string circuito, string operacion, string jsonData, string numera, string emite, dynamic token, dynamic procesos)
        {
            switch (circuito)
            {
                case "VENTAS":
                    return EjecutarVentas(operacion, jsonData, numera, emite, token, procesos);

                case "COMPRAS":
                    return EjecutarCompras(operacion, jsonData, numera, emite, token, procesos);

                default:
                    return "Circuito no soportado: " + circuito;
            }
        }

        /// <summary>
        /// Ejecuta operaciones del circuito VENTAS
        /// </summary>
        static string EjecutarVentas(string operacion, string jsonData, string numera, string emite, dynamic token, dynamic procesos)
        {
            string errores = string.Empty;
            EFlexSDK_Ventas ventas = new EFlexSDK_Ventas(token);
            InjectProcFlex(ventas, token, procesos);

            switch (operacion)
            {
                case "IngresarComprobanteJSON":
                    try { ventas.IngresarComprobanteJSON(jsonData, numera, emite, token); }
                    catch (Exception exDeser)
                    {
                        LogDebug("SDK excepcion (completa):\n" + exDeser.ToString());
                        errores = exDeser.Message;
                        break;
                    }
                    string listaErrores = ventas.ObtenerListaErrores();
                    LogDebug("ObtenerListaErrores: [" + (listaErrores ?? "NULL") + "]");
                    if (!string.IsNullOrEmpty(listaErrores) && !listaErrores.Contains("No existen errores"))
                        errores = listaErrores;
                    break;

                case "IngresarListaComprobantesJSON":
                    try { ventas.IngresarListaComprobantesJSON(jsonData, numera, emite, token); }
                    catch (Exception exDeser) { LogDebug("SDK deserialización (no fatal): " + exDeser.Message); }
                    string listaErroresMultiV = ventas.ObtenerListaErrores();
                    if (!string.IsNullOrEmpty(listaErroresMultiV) && !listaErroresMultiV.Contains("No existen errores"))
                        errores = listaErroresMultiV;
                    break;

                default:
                    errores = "Operación no soportada para VENTAS: " + operacion;
                    break;
            }

            return errores;
        }

        /// <summary>
        /// Ejecuta operaciones del circuito COMPRAS
        /// </summary>
        static string EjecutarCompras(string operacion, string jsonData, string numera, string emite, dynamic token, dynamic procesos)
        {
            string errores = string.Empty;
            EFlexSDK_Compras compras = new EFlexSDK_Compras(token);
            InjectProcFlex(compras, token, procesos);

            switch (operacion)
            {
                case "IngresarComprobanteJSON":
                    try { compras.IngresarComprobanteJSON(jsonData, numera, emite, token); }
                    catch (Exception exDeser) { LogDebug("SDK deserialización (no fatal): " + exDeser.Message); }
                    string listaErrores = compras.ObtenerListaErrores();
                    if (!string.IsNullOrEmpty(listaErrores) && !listaErrores.Contains("No existen errores"))
                        errores = listaErrores;
                    break;

                case "IngresarListaComprobantesJSON":
                    try { compras.IngresarListaComprobantesJSON(jsonData, numera, emite, token); }
                    catch (Exception exDeser) { LogDebug("SDK deserialización (no fatal): " + exDeser.Message); }
                    string listaErroresMulti = compras.ObtenerListaErrores();
                    if (!string.IsNullOrEmpty(listaErroresMulti) && !listaErroresMulti.Contains("No existen errores"))
                        errores = listaErroresMulti;
                    break;

                default:
                    errores = "Operación no soportada para COMPRAS: " + operacion;
                    break;
            }

            return errores;
        }

        /// <summary>
        /// Inyecta _ProcFlex en el circuito via reflexión si el constructor no lo inicializó.
        /// EFlexSDK_Ventas/Compras heredan de EFlexSDK_CircuitoFlex que tiene _ProcFlex privado.
        /// El constructor busca el ProcesoFlex por token pero falla silenciosamente en consola.
        /// </summary>
        static void InjectProcFlex(object circuito, dynamic token, dynamic procesos)
        {
            try
            {
                FieldInfo fi = circuito.GetType().BaseType.GetField("_ProcFlex",
                    BindingFlags.NonPublic | BindingFlags.Instance);

                if (fi == null)
                {
                    LogDebug("InjectProcFlex: campo _ProcFlex no encontrado en clase base");
                    return;
                }

                object current = fi.GetValue(circuito);
                if (current != null)
                {
                    LogDebug("InjectProcFlex: _ProcFlex ya inicializado, OK");
                    return;
                }

                LogDebug("InjectProcFlex: _ProcFlex es null, inyectando...");
                dynamic idResult = procesos.ObtenerIDProcesoToken(token);
                string idProceso = idResult != null ? idResult.ToString() : null;
                LogDebug("ObtenerIDProcesoToken: [" + (idProceso ?? "NULL") + "]");

                if (!string.IsNullOrEmpty(idProceso))
                {
                    object procFlex = procesos[idProceso];
                    LogDebug("procFlex: " + (procFlex == null ? "NULL" : procFlex.GetType().Name));
                    if (procFlex != null)
                    {
                        fi.SetValue(circuito, procFlex);
                        LogDebug("InjectProcFlex: _ProcFlex inyectado OK");
                    }
                }
            }
            catch (Exception ex)
            {
                LogDebug("InjectProcFlex error: " + ex.Message);
            }
        }

        /// <summary>
        /// Escribe el resultado en formato JSON a stdout
        /// </summary>
        static void WriteOutput(bool success, string message, string errors)
        {
            // Escapar strings para JSON
            string jsonMessage = EscapeJsonString(message ?? "");
            string jsonErrors = errors != null ? "\"" + EscapeJsonString(errors) + "\"" : "null";

            string json = "{" +
                "\"success\":" + (success ? "true" : "false") + "," +
                "\"message\":\"" + jsonMessage + "\"," +
                "\"errors\":" + jsonErrors +
                "}";

            Console.WriteLine(json);
        }

        /// <summary>
        /// Escribe mensaje de debug a stderr (no interfiere con stdout JSON)
        /// </summary>
        static void LogDebug(string message)
        {
            Console.Error.WriteLine("[SDKWrapper] " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message);
        }

        /// <summary>
        /// Escapa caracteres especiales para JSON
        /// </summary>
        static string EscapeJsonString(string str)
        {
            if (string.IsNullOrEmpty(str)) return "";
            return str
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\n", "\\n")
                .Replace("\r", "\\r")
                .Replace("\t", "\\t");
        }

        /// <summary>
        /// Parsea argumentos de línea de comandos
        /// </summary>
        static Dictionary<string, string> ParseArgs(string[] args)
        {
            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            // clave puede ser vacía (usuario sin password)
            string[] required = { "empresa", "usuario", "pto-trabajo", "json-file" };

            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i].StartsWith("--"))
                {
                    string key = args[i].Substring(2);
                    string value = args[i + 1];
                    result[key] = value;
                    i++; // skip value
                }
            }

            // Si no se pasó --clave, usar string vacío
            if (!result.ContainsKey("clave"))
                result["clave"] = "";

            // Validar requeridos
            foreach (string req in required)
            {
                if (!result.ContainsKey(req) || string.IsNullOrWhiteSpace(result[req]))
                    return null;
            }

            return result;
        }
    }
}
