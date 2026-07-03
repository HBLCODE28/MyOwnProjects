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
    /// Interaction logic for StatisticsWindow.xaml
    /// </summary>
    public partial class StatisticsWindow : Window
    {
        public StatisticsWindow()
        {
            InitializeComponent();
        }
        private void back(object sender, RoutedEventArgs e)
        {
            Utils.goToMain(this);
        }
        private void getPerformances(object sender, RoutedEventArgs e)
        {
            if(getPerformancesHelper())
            {
                MessageBox.Show("Statistics retrieved successfully!");
            }
        }

        private bool getPerformancesHelper()
        {
            
            bool flagTotalNumberOfQuestions = false;
            bool flagNumberOfRightAnswers = false;
            bool flagAverageAnswerTime = false;
            bool flagNumberOfGamesPlayed = false;
            bool flagStatus = false;
            byte status = Utils._statisticsStatus;

            var message = new Dictionary<string, string>
            {
                { "status", status.ToString() }
            };

            string json = Utils.DictionaryToJson(message);
            char[] trimParts = { '\'', ',', '"', '{', '}' };

            try
            {
                string response = Utils.serverRespond(status, json);

                string[] entries = response.Split(',');
                    foreach (string entry in entries)
                    {
                        string[] parts = entry.Split(':');
                        if (parts.Length != 2) continue;

                        string key = parts[0].Trim(trimParts);
                        string val = parts[1].Trim(trimParts);
                        if (key.Contains("totalNumberOfQuestions"))
                        {
                            totalNumberOfQuestions.Text = "Total amount of questions you have answered: ";
                            totalNumberOfQuestions.Text += val;

                            totalNumberOfQuestions.Visibility = Visibility.Visible;
                            flagTotalNumberOfQuestions = true;
                        }
                        if (key.Contains("numberOfCorrectAnswers"))
                        {
                        numberOfCorrectAnswers.Text = "Total amount of correctly answered questions: ";
                            numberOfCorrectAnswers.Text += val;
                            numberOfCorrectAnswers.Visibility = Visibility.Visible;
                            flagNumberOfRightAnswers = true;
                        }
                        if(key.Contains("averageAnswerTime"))
                        {
                        averageAnswerTime.Text = "Average answer time: ";
                            averageAnswerTime.Text += val;
                            averageAnswerTime.Visibility = Visibility.Visible;
                            flagAverageAnswerTime = true;
                        }
                        if(key.Contains("numberOfGamesPlayed"))
                        {
                            numberOfGamesPlayed.Text = "Total amount of games played: ";
                            numberOfGamesPlayed.Text += val;
                            numberOfGamesPlayed.Visibility = Visibility.Visible;
                            flagNumberOfGamesPlayed = true;
                        }
                        if (key.Contains("status"))
                        {
                            if (val == Utils._validStatusCode)
                            flagStatus = true;
                        }
                    }

                    return flagTotalNumberOfQuestions && flagNumberOfRightAnswers && flagNumberOfGamesPlayed && flagAverageAnswerTime && flagStatus;
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

     
    }
}
