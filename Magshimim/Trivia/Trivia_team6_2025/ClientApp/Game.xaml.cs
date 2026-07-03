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
    public struct deserializedQuestion
    {
        public string[] answers { set; get; }
        public string question { set; get; }
        public int status { set; get; }
    }
    public struct Answer
    {
        public int status { set; get; }
        public int correctAnswerId { set; get; }
    }
    public partial class GameWindow : Window
    {
        private int[] _answers;
        private int _correctAnswers;
        private object _rightObject;
        private int _currentAnswers;
        private int _rightAnswerId;
        public GameWindow()
        {
            InitializeComponent();
            this._answers = new int[(int)GameCodes.maxQuestions];
            this._correctAnswers = 0;
        }
        private void startGameClick(object sender, RoutedEventArgs e)
        {
            string serverAnswer = ClientHandler.SendAndReceive((byte)ServerCodes.startGame, "");
            string answer = ClientHandler.SendAndReceive((byte)ServerCodes.getQuestion, "");// getting the first question when the game is initialized
            deserializedQuestion qs = new deserializedQuestion();
            qs = deserializeGetQuestions(answer);
            this.randomizeAnswer(qs.answers);
            CurrentQuestionText.Text = qs.question;
            CurrentQuestionText.Visibility = Visibility.Visible;
            CorrectAnswersText.Text = "Correct Answers: " + this._correctAnswers.ToString();
            CorrectAnswersText.Visibility = Visibility.Visible;
            Button btn = (Button)(sender);
            btn.Visibility = Visibility.Hidden;
        }
        private void AnswerButton_Click(object sender, RoutedEventArgs e)
        {
            Dictionary<string, string> dict = new Dictionary<string, string>();
            int answerId = 0, i = 0, submitAnswerId = 0;
            bool skip = false;
            if (sender == Option1)
            {
                answerId = 1;
            }
            else if (sender == Option2)
            {
                answerId = 2;
            }
            else if (sender == Option3)
            {
                answerId = 3;
            }
            else if (sender == Option4)
            {
                answerId = 4;
            }
            for (i = 0; i < this._answers.Length; i++)
            {
                if (this._answers[i] == answerId)
                {
                    submitAnswerId = i + 1;
                }
            }
            dict.Add("correctAnswerId", submitAnswerId.ToString());
            string message = Utils.DictionaryToJson(dict);
            byte[] bytes = ClientHandler.PrepareMessage((byte)ServerCodes.submitQuestion, message);
            ClientHandler.Send(bytes, "");
            this._currentAnswers++;
            string questionRes = ClientHandler.Receive();
            Answer ans = deserializeSubmitAnswer(questionRes);
            if (ans.correctAnswerId == submitAnswerId)
            {
                this._correctAnswers++;
            }

            if (this._currentAnswers >= int.Parse(System.Windows.Application.Current.Properties["numberOfQuestions"].ToString()))
            {
                var results = new Results();
                results.Show();
                this.Close();
                skip = true;
            }
            if (!skip)
            {
                string res = ClientHandler.SendAndReceive((byte)ServerCodes.getQuestion, "");

                deserializedQuestion qs = new deserializedQuestion();
                qs = deserializeGetQuestions(res);
                CurrentQuestionText.Text = qs.question;
                CurrentQuestionText.Visibility = Visibility.Visible;
                CorrectAnswersText.Text = "Correct Answers: " + this._correctAnswers.ToString();
                CorrectAnswersText.Visibility = Visibility.Visible;
                this.randomizeAnswer(qs.answers);
            }
        }
        private Answer deserializeSubmitAnswer(string res)
        {
            int i = 0;
            char[] trimChars = { '[', ']', '{', '}', '"' };
            for (i = 0; i < trimChars.Length; i++)
            {
                res = res.Replace(trimChars[i].ToString(), "");
            }
            string[] answers = res.Split(',');
            Answer ans = new Answer();
            ans.correctAnswerId = int.Parse(answers[0].Split(':')[1]);
            ans.status = int.Parse(answers[1].Split(':')[1]);
            return ans;
        }
        private void randomizeAnswer(string[] answers)
        {

            Random random = new Random();
            int i = 0;
            this._answers[0] = random.Next(1, 5);
            do
            {
                this._answers[1] = random.Next(1, 5);
            } while (this._answers[1] == this._answers[0]);

            do
            {
                this._answers[2] = random.Next(1, 5);
            } while ((this._answers[2] == this._answers[0]) || (this._answers[1] == this._answers[2]));
            switch (this._answers[0])
            {
                case 1:
                    this._rightObject = Option1;
                    this._rightAnswerId = 1;
                    break;
                case 2:
                    this._rightObject = Option2;
                    this._rightAnswerId = 2;
                    break;
                case 3:
                    this._rightObject = Option3;
                    this._rightAnswerId = 3;
                    break;
                case 4:
                    this._rightObject = Option4;
                    this._rightAnswerId = 4;
                    break;
            }

            switch (this._answers[1] + this._answers[0] + this._answers[2])
            {
                case 6:
                    this._answers[3] = 4;
                    break;
                case 7:
                    this._answers[3] = 3;
                    break;
                case 8:
                    this._answers[3] = 2;
                    break;

                case 9:
                    this._answers[3] = 1;
                    break;
            }
            for (i = 0; i < this._answers.Length; i++)
            {
                switch (this._answers[i])
                {
                    case 1:
                        Option1.Content = answers[i];
                        Option1.Visibility = Visibility.Visible;
                        break;
                    case 2:
                        Option2.Content = answers[i];
                        Option2.Visibility = Visibility.Visible;
                        break;
                    case 3:
                        Option3.Content = answers[i];
                        Option3.Visibility = Visibility.Visible;
                        break;
                    case 4:
                        Option4.Content = answers[i];
                        Option4.Visibility = Visibility.Visible;
                        break;
                }

            }

        }
        private deserializedQuestion deserializeGetQuestions(string serverAnswer)
        {
            int i = 0, j = 0;
            char[] trimChars = { '[', ']', '{', '}', '"' };
            for (i = 0; i < trimChars.Length; i++)
            {
                serverAnswer = serverAnswer.Replace(trimChars[i].ToString(), "");
            }

            string[] fields = serverAnswer.Split(':');
            string[] answers = fields[1].Split(',');
            deserializedQuestion qs = new deserializedQuestion();
            qs.answers = new string[answers.Length / 2];
            for (i = 1; i < answers.Length; i += 2)
            {
                qs.answers[j] = answers[i];
                j++;
            }
            qs.question = fields[2].Substring(0, fields[2].LastIndexOf(','));
            qs.status = int.Parse(fields[3]);
            return qs;
        }
    }
}





