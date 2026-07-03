using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
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
    /// Interaction logic for Results.xaml
    /// </summary>
    public partial class Results : Window
    {
        public struct GameResults
        {
            int status { get; set; }
            deserializedGameResults[] playersResults { get; set; }
        }
        public struct deserializedGameResults
        {
            public string username { set; get; }
            public int averageAnswerTime { set; get; }
            public int correctAnswerCount { set; get; }
            public int wrongAnswerCount { set; get; }
        }
        
        public Results()
        {
            InitializeComponent();
            string message = ClientHandler.SendAndReceive((byte)ServerCodes.gameResults, "");
            deserializedGameResults[] players = this.desGameResults(message);
            int i = 0;
            for (i = 0; i < players.Length; i++)
            {
                ListBoxItem item = new ListBoxItem();
                item.Content ="Username: "+ players[i].username.ToString();
                item.Content += "\nAverage answer time: " + players[i].averageAnswerTime.ToString();
                item.Content += "\nNumber of correct answers: " + players[i].correctAnswerCount.ToString();
                item.Content += "\nNumber of wrong answers: " + players[i].wrongAnswerCount.ToString()+"\n";
                playerStats.Items.Add(item);
            }
        }
        public int getResultsStatus(string message)
        {
            return int.Parse(message.Substring(message.LastIndexOf(':') + 1, message.LastIndexOf('}')));
        }
        private deserializedGameResults[] desGameResults(string results)
        {
            int i = 0;
            deserializedGameResults[] res = new deserializedGameResults[results.Count(u => u == 'u')/5]; // counts the amount of usernames
            
            int firstIndex = results.IndexOf('[') + 1,lastIndex = results.IndexOf(']');
            results = results.Substring(firstIndex, lastIndex-firstIndex);
            string[] dict = results.Split(',');
            string value = "";
            char[] trimChars = { '"', ',', '}', '{', ':' };
            foreach (string entry in dict)
            {

                value = entry.Split(':')[1];
                value = value.Trim(trimChars);
                if (entry.Contains("wrongAnswerCount"))
                {
                    res[i].wrongAnswerCount = int.Parse(value);
                    i++;
                    if (i < res.Length)
                    {
                        res[i] = new deserializedGameResults();
                    }
                }
                if (entry.Contains("correctAnswersCount"))
                {
                    res[i].correctAnswerCount = int.Parse(value);
                }
                if (entry.Contains("averageAnswerTime"))
                {
                    res[i].averageAnswerTime = int.Parse(value);
                }
                if (entry.Contains("username"))
                {
                    res[i].username = value;
                }
            }
                return res;
        }
    }
}
