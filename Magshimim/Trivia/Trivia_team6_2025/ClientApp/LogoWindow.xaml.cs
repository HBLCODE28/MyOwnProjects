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
    /// Interaction logic for LogoWindow.xaml
    /// </summary>
    public partial class LogoWindow : Window
    {
        public LogoWindow()
        {
            InitializeComponent();
            Loaded += LogoWindow_Loaded;
        }

        private async void LogoWindow_Loaded(object sender, RoutedEventArgs e)
        {
            await Task.Delay(1000); // הצג לשנייה (1000 מילי־שניות)
            var mainWindow = new Main();
            try
            {
                mainWindow.Show();
            }
            catch (Exception exception)
            {
                Close();
            }

            Close();

        }
    }
}
