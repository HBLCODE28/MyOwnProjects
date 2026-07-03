using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows;
using System.Collections.Concurrent;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows.Input;
using Microsoft.VisualBasic;
using ClientApp;
using System.Text.RegularExpressions;

namespace ClientApp
{
    public static class Utils
    {
        public const string _server = "127.0.0.1";
        public const int _port = 8826;
        public const int _serverMessageLength = 1024;
        public const string _serverNotConnectedMessage = "Server is not connected. Please make sure the server is running.";
        public const string _validStatusCode = "1";
        public const int _offset = 0;
        private static readonly char[] ForbiddenChars = { ':', '"', '\'', '\\', ';', '{', '}', '[', ']', '<', '>', '`' };
        public const int _logInStatus = 1;
        public const int _joinRoomStatus = 102;
        public const int _getRoomStatus = 101;
        public const int _signUpStatus = 2;
        public const int _statisticsStatus = 201;
        public const int _createRoomStatus = 100;


        public static bool ContainsForbiddenChars(string input)
        {
            return input.IndexOfAny(ForbiddenChars) >= 0;
        }

        public static string DictionaryToJson(Dictionary<string, string> dict)
        {
            var sb = new StringBuilder();
            sb.Append("{");

            foreach (var pair in dict)
            {
                sb.Append($"\"{pair.Key}\":\"{pair.Value}\",");
            }

            if (dict.Count > 0)
                sb.Length--;

            sb.Append("}");
            return sb.ToString();
        }
        public static void goToMain(Window window)
        {
            var Main = new Main();
            Main.Show();
            window.Close();
        }
        public static string serverRespond(byte status, string json)
        {
            string response = ClientHandler.SendAndReceive(status, json);
            response = Regex.Replace(response, @"^.*?(?=\{)", "");
            response = response.Replace("{", "").Replace("}", ""); //remove { } from the response string 
            return response;
        }
        public static string serverRespond(byte status)
        {
            string response = ClientHandler.SendAndReceive(status);
            response = Regex.Replace(response, @"^.*?(?=\{)", "");
            response = response.Replace("{", "").Replace("}", ""); //remove { } from the response string 
            return response;
        }

    }
    public static class Print
    {
        public static void Error(string msg)
        {
            string title = "Error :(";
            MessageBoxButton messageBoxButton = MessageBoxButton.OK;
            MessageBoxImage messageBoxImage = MessageBoxImage.Error;
            MessageBox.Show(msg, title, messageBoxButton, messageBoxImage);

        }
        public static void Welcom(string userName, string type)
        {
            string title = type + " success!";
            MessageBoxButton messageBoxButton = MessageBoxButton.OK;
            MessageBox.Show("Welcom! " + userName, title, messageBoxButton);

        }
        public static void failed(string error, string type)
        {
            string title = type + "failed :(";
            MessageBoxButton messageBoxButton = MessageBoxButton.OK;
            MessageBoxImage messageBoxImage = MessageBoxImage.Error;
            MessageBox.Show("Error Occurred : " + error, title, messageBoxButton, messageBoxImage);

        }
        
    }
    public static class ClientHandler
    {
        private static TcpClient _client;
        private static NetworkStream _stream;
        private static bool _isConnected = false;
        private static readonly object _sendLock = new object();
        private static bool _waitingForResponse = false;
        public static ConcurrentQueue<string> _messageQueue = new ConcurrentQueue<string>();

        // Event triggered when a message is received from the server
        public static event Action<string> OnMessageReceived;

        // Event triggered when a message is sent to the server
        public static event Action<string> OnMessageSent;

        static ClientHandler()
        {
            _client = new TcpClient(Utils._server, Utils._port);
            _stream = _client.GetStream();
            _isConnected = true;
        }

        public static string SendAndReceive(byte statusCode, string jsonMessage)
        {
            if (!_isConnected)
                throw new InvalidOperationException(Utils._serverNotConnectedMessage);

            lock (_sendLock)
            {
                _waitingForResponse = true;
                try
                {
                    byte[] fullMessage = PrepareMessage(statusCode, jsonMessage);
                    Send(fullMessage, jsonMessage);
                    string recevie = Receive();
                    if (recevie == "\0")
                    {
                        throw new Exception("server returned error status");
                    }
                    return recevie;
                }
                finally
                {
                    _waitingForResponse = false; // This will always run, even if there's a return inside the try block
                }
            }
        }
        public static string SendAndReceive(byte statusCode)
        {
            if (!_isConnected)
                throw new InvalidOperationException(Utils._serverNotConnectedMessage);

            lock (_sendLock)
            {
                _waitingForResponse = true;
                try
                {
                    byte[] statusOnlyMessage = new byte[] { statusCode };
                    _stream.Write(statusOnlyMessage, Utils._offset, statusOnlyMessage.Length);
                    OnMessageSent?.Invoke($"{statusCode}");

                    string recevie= Receive();
                    if(recevie=="\0")
                    {
                        throw new Exception("server returned error status");
                    }
                    return recevie;
                }
                finally
                {
                    _waitingForResponse = false;
                }
            }
        }

        public static byte[] PrepareMessage(byte statusCode, string jsonMessage)
        {
            byte[] messageBytes = Encoding.UTF8.GetBytes(jsonMessage);
            byte[] lengthBytes = BitConverter.GetBytes(messageBytes.Length);
            int sourceIndex = 0;
            int destinationIndex = 1;
            int length = 4;
            if (BitConverter.IsLittleEndian)
                Array.Reverse(lengthBytes);

            byte[] fullMessage = new byte[1 + 4 + messageBytes.Length];
            fullMessage[0] = statusCode;
            Array.Copy(lengthBytes, sourceIndex, fullMessage, destinationIndex, length);
            Array.Copy(messageBytes, sourceIndex, fullMessage, destinationIndex + 4, messageBytes.Length);
            return fullMessage;
        }

        public static void Send(byte[] fullMessage, string jsonMessage)
        {
            _stream.Write(fullMessage, Utils._offset, fullMessage.Length);
            OnMessageSent?.Invoke(jsonMessage);
        }


        public static string Receive(int maxAttempts = 500, int delayMs = 10)
        {
            byte[] buffer = new byte[1024]; 

            for (int i = 0; i < maxAttempts; i++)
            {
                if (_stream.DataAvailable) 
                {
                    int bytesRead = _stream.Read(buffer, 0, buffer.Length);

                    if (bytesRead > 0)
                    {
                        string message = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                        if (!string.IsNullOrEmpty(message))
                            return message;
                    }
                }

                Thread.Sleep(delayMs);
            }

            throw new TimeoutException("No message received within the time limit.");
        }



        public static void ListenToServer()
        {
            int index = 0;

            new Thread(() =>
            {
                try
                {
                    while (_isConnected)
                    {
                        byte[] buffer = new byte[Utils._serverMessageLength];
                        int bytesRead = 1;
                        if (bytesRead > 0)
                        {
                            string message = Encoding.UTF8.GetString(buffer, index, bytesRead);

                            if (!_waitingForResponse)
                            {
                                OnMessageReceived?.Invoke(message);
                            }
                            else
                            {
                                _messageQueue.Enqueue(message);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Error while reading from server: " + ex.Message);
                    Disconnect();
                }
            }).Start();
        }

        public static void Disconnect()
        {
            if (_isConnected)
            {
                _isConnected = false;
                _stream?.Close();
                _client?.Close();
            }
        }
    }
    public class Room
    {
        public string Name { get; set; }
        public int Number { get; set; }
        public bool IsActive { get; set; }
        public int MaxUsers { get; set; }
        public string[] Users { get; set; }

        public string DisplayInfo =>
            $"Room: {Name} (#{Number}) | Status: {(IsActive ? "Active" : "Inactive")} | Users: {string.Join(", ", Users)} | Users Limit : {MaxUsers}";
    }
    enum GameCodes
    {
        maxQuestions=4
    }
    enum ServerCodes
    {
        getQuestion=151,
        submitQuestion=152,
        gameResults=153,
        startGame =105
    }
}

