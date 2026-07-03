using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using static System.Net.Mime.MediaTypeNames;


namespace ClientApp
{
    public partial class Main : Window
    {
       
        private static Queue<string> messageQueue = new Queue<string>();
        private static NetworkStream stream;
        private RedAlertService _redAlertService = new RedAlertService();

        public Main()
        {
           

            InitializeComponent();
  
            _redAlertService = new RedAlertService();
            _redAlertService.OnRedAlert += RedAlertReceived;

            _redAlertService.Start();

            clientStart();
            if (System.Windows.Application.Current.Properties["Username"] !=  null &&
                System.Windows.Application.Current.Properties["Password"] !=null &&
                System.Windows.Application.Current.Properties["Email"] != null)
            {
                SignUp.IsEnabled = false;
                LogIn.IsEnabled = false;
                JoinRoom.IsEnabled = true;
                CreateRoom.IsEnabled = true;
                MyStatistics.IsEnabled = true;
            }
        }
        private void Example_Click(object sender, RoutedEventArgs e)
        {
            byte status = 0;
            var message = new Dictionary<string, string>
            {
                { "status", status.ToString() }
            };
            string json = Utils.DictionaryToJson(message);
            string response = Utils.serverRespond(status, json);
            Print.failed(response, "example");
        }
        private void RedAlertReceived(string message)
        {
            // You can update UI via the Dispatcher
            Dispatcher.Invoke(() =>
            {
                MessageBox.Show(message);
            });
        }
        private void ShowRedAlert(string message)
        {
            RedAlertOverlay.Visibility = Visibility.Visible;

            var anim = new DoubleAnimation
            {
                From = -100,
                To = 0,
                Duration = TimeSpan.FromSeconds(0.5),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
            };

            RedAlertOverlay.RenderTransform.BeginAnimation(TranslateTransform.YProperty, anim);

            
        }

        private void CloseRedAlert_Click(object sender, RoutedEventArgs e)
        {
            RedAlertOverlay.Visibility = Visibility.Collapsed;
        }
        private void LogIn_Click(object sender, RoutedEventArgs e)
        {
            var logInWindow = new LogInWindow();
            logInWindow.Show();
            this.Close();
        }
        private void SignUp_Click(object sender, RoutedEventArgs e)
        {
            var signUpWindow = new SignUpWindow();
            signUpWindow.Show();
            this.Close();
        }
        private void Exit_Click(object sender, RoutedEventArgs e)
        {
            System.Windows.Application.Current.Shutdown();
        }
        private void JoinRoom_Click(object sender, RoutedEventArgs e)
        {
            var joinRoomWindow = new JoinRoom();
            joinRoomWindow.Show();
            this.Close();
        }
        private void CreateRoom_Click(object sender, RoutedEventArgs e)
        {
            var createRoomWindow = new CreateRoomWindow();
            createRoomWindow.Show();
            this.Close();
        }
        private void Statistics_Click(object sender, RoutedEventArgs e)
        {
            var statisticsWindow = new StatisticsWindow();
            statisticsWindow.Show();
            this.Close();
        }
        
        void clientStart() 
        {
            try
            {
                ClientHandler.ListenToServer();
            }
            catch (Exception e)
            {
                serverIsNotConnected();
                this.Close();
            }
        }
        private void serverIsNotConnected()
        {
            string title = "Error :(";
            MessageBoxButton messageBoxButton = MessageBoxButton.OK;
            MessageBoxImage messageBoxImage = MessageBoxImage.Error;
            MessageBox.Show("Make sure the server is connected", title, messageBoxButton, messageBoxImage);
        }
      
    }
}
