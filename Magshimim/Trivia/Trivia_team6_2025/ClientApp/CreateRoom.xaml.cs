using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace ClientApp
{
    /// <summary>
    /// Interaction logic for CreateRoomWindow.xaml
    /// </summary>
    public partial class CreateRoomWindow : Window
    {
        public CreateRoomWindow()
        {
            InitializeComponent();
        }

        private void back(object sender, RoutedEventArgs e)
        {
            Utils.goToMain(this);
        }
        private void CreateRoomButton_Click(object sender, RoutedEventArgs e)
        {
            string roomName=RoomName.Text.Trim();
            if(string.IsNullOrEmpty(roomName))
            {
                Print.Error("Room name cannot be empty.");
                return;
            }
            if (SendRoomToServer(roomName))
            {
                MessageBox.Show("Room created successfully!");
                var GameRoom = new GameWindow();
                GameRoom.Show();
                this.Close();
            }
            else
            {
                Print.Error("Failed to create room.");
            }
        }

        private bool SendRoomToServer(string roomName )
        {

            byte status = Utils._createRoomStatus; 
            Dictionary<string, string> message = creatMessage(roomName);
            string json = Utils.DictionaryToJson(message);


            try
            {
                string response = Utils.serverRespond(status, json);
                string[] entries = response.Split(';');
                    
                return checkEntries(entries);
            }
            catch (SocketException e)
            {
                Print.Error("SocketException: " + e.Message);
                Utils.goToMain(this);
            }
            catch (Exception e)
            {
                Print.Error("Exception: " + e.Message);
                Utils.goToMain(this);
            }
            return false;
        }
        public bool checkEntries(string[] entries)
        {
            foreach (string entry in entries)
            {
                if (!entry.Contains(":")) continue;

                string[] parts = entry.Split(':');
                if (parts.Length != 2) continue;

                string key = parts[0].Trim();
                key = Regex.Replace(key, @"[\p{C}""\\]", "");
                string val = parts[1].Trim();
                val = Regex.Replace(val, @"[\p{C}""\\]", "");


                if (key.Contains("status"))
                {
                    if (val == Utils._validStatusCode)
                        return  true;
                }

            }
            return false;
        }
        public Dictionary<string, string> creatMessage(string roomName)
        {
            int maxUsers = 50;
            Random random = new Random();
            int questionCount = random.Next(10, 20); // Randomly choose between 10 and 20 questions
            int answerTimeout = random.Next(15, 30); // Randomly choose between 15 and 30 seconds
            if (!System.Windows.Application.Current.Properties.Contains("allRoomNumbers"))
            {
                System.Windows.Application.Current.Properties["allRoomNumbers"] = new List<string>();
            }
            int roomNumber = ((List<string>)System.Windows.Application.Current.Properties["allRoomNumbers"]).Count + 1;
            string currentUserName = System.Windows.Application.Current.Properties["Username"] as string;
            System.Windows.Application.Current.Properties["numberOfQuestions"]= questionCount.ToString();

    var message = new Dictionary<string, string>
            {
                { "numberOfQuestions", questionCount.ToString() },
                { "roomName", roomName },
                { "roomNumber", roomNumber.ToString() },
                { "isActive", "true" },
                { "maxUsers", maxUsers.ToString() },
                { "users", currentUserName },
                { "answerTimeout", answerTimeout.ToString() },

            };
            return message;
        }
        
    }
}
