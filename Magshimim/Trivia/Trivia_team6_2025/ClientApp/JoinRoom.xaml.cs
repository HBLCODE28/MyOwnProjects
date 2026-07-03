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
    /// Interaction logic for JoinRoom.xaml
    /// </summary>
    public partial class JoinRoom : Window
    {
        public JoinRoom()
        {
            InitializeComponent();
        }
        private void back(object sender, RoutedEventArgs e)
        {
            Utils.goToMain(this);
        }

        private void RoomLists_Loaded(object sender, RoutedEventArgs e)
        {
            string userName = System.Windows.Application.Current.Properties["Username"] as string;
            if (!getRoomsFromServer(userName))
            {
                dontHaveRooms.Visibility = Visibility.Visible;
            }
        }


        private bool getRoomsFromServer(string userName)
        {
            const byte statusCode = Utils._getRoomStatus;

            try
            {
                string response = Utils.serverRespond(statusCode);

                //Find where the "rooms" array begins
                int roomsStartIndex = response.IndexOf("\"rooms\":[");
                if (roomsStartIndex == -1)
                {
                    Print.Error("No rooms found in response.");
                    return false;
                }

                string[] roomEntries = getRoomEntries(response, roomsStartIndex);
                creatRoom(roomEntries);
                return true;
            }
            catch (Exception ex)
            {
                Print.Error("Error parsing response: " + ex.Message);
                return false;
            }
        }
        private string[] getRoomEntries(string response , int roomsStartIndex)
        {
            //Extract only the array part
            string roomsArray = response.Substring(roomsStartIndex + 8); // skip "rooms":
            int bracketStart = roomsArray.IndexOf('[');
            int bracketEnd = roomsArray.LastIndexOf(']');
            if (bracketStart == -1 || bracketEnd == -1 || bracketEnd <= bracketStart)
            {
                throw new FormatException("Malformed rooms array in response.");
            }
            string rawArray = roomsArray.Substring(bracketStart + 1, bracketEnd - bracketStart - 1);
            if (rawArray == "" || roomsArray == null)
            {
                throw new FormatException("No rooms found in response.");
            }

            //Split the array into separate room entries by "},{"
            string[] roomEntries = rawArray.Split(new[] { "},{" }, StringSplitOptions.None);
            return roomEntries;
        }
        private void creatRoom(string[] roomEntries)
        {
            foreach (string entry in roomEntries)
            {
                string cleanEntry = entry.Trim('{', '}');
                int numQuestions = 0;
                string roomName = "";
                int roomNumber = 0;
                bool isActive = false;
                int maxUsers = 0;

                //Convert each room entry to a key-value dictionary
                Dictionary<string, string> kv = cleanEntry
                    .Split(',')
                    .Select(s => s.Split(':'))
                    .Where(p => p.Length >= 2)
                    .ToDictionary(p => p[0].Trim('\"'), p => p[1].Trim('\"', '[', ']'));

                //Parse expected fields
                if(kv.ContainsKey("numberOfQuestions") && kv.ContainsKey("roomName") && kv.ContainsKey("numberOfQuestions") && kv.ContainsKey("roomNumber") && kv.ContainsKey("isActive") && kv.ContainsKey("maxUsers"))
                {
                    int.TryParse(kv["numberOfQuestions"], out  numQuestions);
                    System.Windows.Application.Current.Properties["numberOfQuestions"] = numQuestions.ToString();
                    roomName = kv["roomName"];
                    int.TryParse(kv["roomNumber"], out  roomNumber);
                    bool.TryParse(kv["isActive"], out  isActive);
                    int.TryParse(kv["maxUsers"], out  maxUsers);
                }
               
                //Parse users array (comma-separated)
                string[] users = kv.ContainsKey("users") ? kv["users"].Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries) : new string[0];

                //Create and add the room
                Room room = new Room
                {
                    Name = roomName,
                    Number = roomNumber,
                    IsActive = isActive,
                    MaxUsers = maxUsers,
                    Users = users
                };

                RoomLists.Items.Add(room);
            }
        }



        private bool joinRoom(int roomId)
        {
            byte status = Utils._joinRoomStatus;
            var dict = new Dictionary<string, string>
            {

                { "roomId", roomId.ToString() }
            };
            string json = Utils.DictionaryToJson(dict);

            try
            {
                string response = Utils.serverRespond(status, json);

                string[] parts = response.Split(':');
                foreach (string part in parts)
                {
                    string key = parts[0].Trim();
                    string val = parts[1].Trim();

                    if (key.Contains("status") && val == Utils._validStatusCode)
                        return  true;
                }
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
        private void JoinRoom_Click(object sender, RoutedEventArgs e)
        {
            var button = sender as Button;
            var room = button?.DataContext as Room;

            if (room != null)
            {
                MessageBox.Show($"join {room.Name} (#{room.Number})");
                if (joinRoom(room.Number))
                {
                    Print.Welcom(System.Windows.Application.Current.Properties["Username"] as string, "Join Room");
                    System.Windows.Application.Current.Properties["roomNumber"] = room.Number;
                    goToGame();
                }
                else
                {
                    Print.Error("Failed to join the room.");
                }
            }
            else
            {
                Print.Error("Room not found.");
            }
        }
        public void goToGame()
        {
            var gameWindow = new GameWindow();
            gameWindow.Show();
            this.Close();
        }
    }
}
