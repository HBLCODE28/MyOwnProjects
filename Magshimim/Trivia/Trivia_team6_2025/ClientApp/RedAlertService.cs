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

namespace ClientApp
{
    public class RedAlertService
    {
        private Timer _timer;
        public event Action<string> OnRedAlert;
        public string _city = "";
        static Dictionary<string, string> cityHe = new Dictionary<string, string>()
        {
            ["Jerusalem"] = "ירושלים",
            ["Tel Aviv–Yafo"] = "תל אביב‑יפו",
            ["Haifa"] = "חיפה",
            ["Rishon LeZion"] = "ראשון לציון",
            ["Ashdod"] = "אשדוד",
            ["Beersheba"] = "באר שבע",
            ["Petah Tikva"] = "פתח‑תקווה",
            ["Netanya"] = "נתניה",
            ["Holon"] = "חולון",
            ["Bnei Brak"] = "בני ברק",
            ["Bat Yam"] = "בת ים",
            ["Ramat Gan"] = "רמת גן",
            ["Ashkelon"] = "אשקלון",
            ["Rehovot"] = "רחובות",
            ["Beit Shemesh"] = "בית שמש",
            ["Kfar Saba"] = "כפר סבא",
            ["Hod HaSharon"] = "הוד‑השרון",
            ["Lod"] = "לוד",
            ["Nahariya"] = "נהריה",
            ["Tiberias"] = "טבריה",
            ["Nazareth"] = "נצרת",
            ["Acre"] = "עכו",
            ["Afula"] = "עפולה",
            ["Arad"] = "ערד",
            ["Dimona"] = "דימונה",
            ["Eilat"] = "אילת",
            ["Beit She'an"] = "בית שאן",
            ["Rehovot"] = "רחובות",
            ["Kiryat Gat"] = "קריית גת",
            ["Kiryat Bialik"] = "קריית ביאליק",
            ["Givatayim"] = "גבעתיים",
            ["Modi'in-Maccabim-Re'ut"] = "מודיעין‑מכבים‑רעות",
            ["Yavne"] = "יבנה",
            ["Yehud‑Monosson"] = "יהוד‑מונוסון",
            ["Ness Ziona"] = "נס ציונה",
            ["Qiryat Shemona"] = "קריית שמונה",
            ["Ganei Tikva"] = "גני תקווה",
            ["El'ad"] = "אלעד",
            ["Kafr Qasim"] = "כפר קאסם",
            ["Kfar Yona"] = "כפר יונה",
            ["Rosh HaAyin"] = "ראש העין",
            ["Safed"] = "צפת",
            ["Nahariya"] = "נהריה",
            ["Kafr Kanna"] = "כפר כנא",
            ["Tamra"] = "טמרה",
            ["Tiberias"] = "טבריה",
            ["Ariel"] = "אריאל",
            ["Givat Shmuel"] = "גבעת שמואל",
            ["Beitar Illit"] = "ביתר עילית",
            ["Or Yehuda"] = "אור יהודה",
            ["Yehud"] = "יהוד",
            ["Ramla"] = "רמלה",
            ["Carmiel"] = "כרמיאל",
            ["Safed"] = "צפת",
            ["Acre"] = "עכו",
            ["Beersheba"] = "באר שבע",
            ["Elat"] = "אילת"
        };
        public void Start(int delayInSeconds = 10)
        {
            _timer = new Timer(_ =>
            {
                _ = FetchAlertsAsync();
            },
            null,
            TimeSpan.Zero,
            TimeSpan.FromSeconds(delayInSeconds));
        }

        public async Task city()
        {
            try
            {
                using (HttpClient client = new HttpClient())
                {
                    string url = "https://ipinfo.io/json";
                    var response = await client.GetStringAsync(url);

                    this._city = response.Split('"')[7];
                    this._city = cityHe.ContainsKey(this._city) ? cityHe[this._city] : this._city;
                    if (string.IsNullOrEmpty(this._city))
                    {
                        throw new Exception("City not found in the response.");
                    }

                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching city: {ex.Message}");
            }
        }

        private async Task FetchAlertsAsync()
        {

            Task at = city();
            try
            {

                using (HttpClient client = new HttpClient())
                {
                    string html = await client.GetStringAsync("https://api.tzevaadom.co.il/notifications");
                    if (html.Contains("עכו") && _city != "")
                    {
                        OnRedAlert?.Invoke($"Red Alert in עכו!");
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching alerts: {ex.Message}");
            }
        }
    }

}
