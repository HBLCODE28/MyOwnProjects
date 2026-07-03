#include "SqliteDatabase.h"

SqliteDatabase::SqliteDatabase(const std::string databaseName) :IDatabase()
{
	this->_db = nullptr;
	this->_databaseName = databaseName;
}
SqliteDatabase::~SqliteDatabase()
{
	
}
bool SqliteDatabase::open()
{
	
	const char* tables[NUM_OF_TABLES] = 
	{
		"CREATE TABLE IF NOT EXISTS User( username TEXT NOT NULL PRIMARY KEY , password TEXT NOT NULL , email TEXT NOT NULL);",
		"CREATE TABLE IF NOT EXISTS statistics(game_id  INT NOT NULL, username TEXT NOT NULL , questions_answered INT NOT NULL, correctly_answered_questions INT NOT NULL, avg_time_to_answer REAL NOT NULL, score INT NOT NULL);",
		"CREATE TABLE IF NOT EXISTS Question( question TEXT PRIMARY KEY NOT NULL,right_answer TEXT NOT NULL, wrong_answer1 TEXT NOT NULL, wrong_answer2 TEXT, wrong_answer3 TEXT);"
		"CREATE TABLE IF NOT EXISTS Game(game_id INT , PRIMARY KEY(game_id));"
	};
	const char* initTable = "INSERT INTO Game (game_id) VALUES(1);";
	char* errorMessage = nullptr;
	int doesFileExist = _access(this->_databaseName.c_str(), 0);
	int res = sqlite3_open(this->_databaseName.c_str(), &this->_db),i=0;

	if (SQLITE_OK != res)
	{
		return false;
	}
	if (doesFileExist)
	{
		for (i = 0;i < NUM_OF_TABLES;i++) 
		{
			res = sqlite3_exec(this->_db, tables[i], nullptr, nullptr, &errorMessage);
			if (SQLITE_OK != res)
			{
				std::cout << "Error from database: " << errorMessage << "\n";
				return false;
			}
		}
		res = sqlite3_exec(this->_db, initTable, nullptr, nullptr, &errorMessage);
		if (SQLITE_OK != res)
		{
			std::cout << "Error when initiating database: " << errorMessage << "\n";
			return false;
		}
		this->insertTenRandomQuestions();
	}
	return true;
}
bool SqliteDatabase::close() 
{
	int res = sqlite3_close(this->_db);
	return SQLITE_OK != res;
}
int SqliteDatabase::_doesUserExist(void* data, int argc, char** argv, char** azColname)
{
	bool* userMatched = (bool*)data;
	*userMatched= (argc != 0); // if there are no arguments then the user does not exist
	return 0;
}
bool SqliteDatabase::doesUserExist(const std::string& user)
{
	char* errorMessage = nullptr;
	std::string getUser = "SELECT * FROM User WHERE username LIKE '" + user + "';";
	bool userMatches = false;
	std::shared_lock<std::shared_mutex> lock(this->_databaseMtx); // locking for reading

	int res = sqlite3_exec(this->_db, getUser.c_str(), SqliteDatabase::_doesUserExist, &userMatches,&errorMessage);
	lock.unlock(); // unlocking
	if (SQLITE_OK != res)
	{
		std::cout << errorMessage << "\n";
	}
	
	return userMatches;
}
int SqliteDatabase::_doesPasswordMatch(void* data, int argc, char** argv, char** azColname)
{
	bool* matchedPass = (bool*) data;
	*matchedPass = (argc != 0); // if there are no argument then the password does not match
	return 0;
}
bool SqliteDatabase::doesPasswordMatch(const std::string& user, const std::string& password)
{
	char* errorMessage = nullptr;
	std::string getPasswordAndUser = "SELECT * FROM User WHERE username LIKE '" + user + "' AND password LIKE '" + password + "';";
	bool passwordMatches = false;
	std::shared_lock<std::shared_mutex> readDbLock(this->_databaseMtx); // locking for reading

	int res = sqlite3_exec(this->_db, getPasswordAndUser.c_str(), SqliteDatabase::_doesPasswordMatch, &passwordMatches,&errorMessage);
	readDbLock.unlock(); // unlocking 
	if (SQLITE_OK != res) 
	{
		std::cout << errorMessage << "\n";
	}
	return passwordMatches;
}
bool SqliteDatabase::addNewUser(const std::string& user, const std::string& password, const std::string& email)
{
	char* errorMessage = nullptr;
	std::string createUser = "INSERT INTO User (username,password,email) VALUES ('" + user + "','" + password + "','" + email + "');";
	std::lock_guard <std::shared_mutex> userLock(this->_databaseMtx); // only one thread can insert a new user

	int res = sqlite3_exec(this->_db, createUser.c_str(), nullptr, nullptr, &errorMessage); // executing the query

	return SQLITE_OK == res; // if an error occurs it means that there is already a user with the same name
}

int SqliteDatabase::_getAveragePlayerTime(void* data, int argc, char** argv, char** azColname) 
{
	float* time = (float*)data;
	if (0 == argc) 
	{
		*time = -1;
	}
	else 
	{
		if (argv[0]) {
			*time = std::stof(argv[0]);
		}
		else 
		{ 
			*time = 0;
		}
		
	}
	return 0;
}

float SqliteDatabase::getPlayerAverageAnswerTime(const std::string& username) 
{
	std::string getAverageAnswerTimeQuery = "SELECT AVG(avg_time_to_answer) FROM statistics WHERE username LIKE'" + username + "';";
	float averageTime = 0;
	char* errorMessage = nullptr;
	std::shared_lock<std::shared_mutex> timeLock(this->_statisticsTalbeMtx);
	int res =sqlite3_exec(this->_db, getAverageAnswerTimeQuery.c_str(), _getIntFromQuery, &averageTime, &errorMessage);
	timeLock.unlock();
	if (SQLITE_OK != res)
	{
		std::cout << errorMessage << "\n";
	}
	return averageTime;
}
/*
	Function that retrieves int from arv[0]
	input: data , number of arguments ,data and column names
	output: none
*/
int SqliteDatabase::_getIntFromQuery(void* data, int argc, char** argv, char** azColname)
{
	int* answer = (int*)data;
	if (0 == argc) 
	{
		*answer = -1;
	}
	else 
	{
		if (argv[0])
		{
			*answer = std::atoi(argv[0]);
		}
		else 
		{
			*answer = 0;
		}
	}
	return 0;
}

int SqliteDatabase::getNumOfCorrectAnswers(const std::string& username) 
{
	std::string getNumOfCorrectAnswersQuery = "SELECT SUM(correctly_answered_questions) FROM statistics WHERE username LIKE '" + username + "';";
	int correctQuestions = 0;
	char* errorMessage = nullptr;
	std::shared_lock<std::shared_mutex> answersLock(this->_statisticsTalbeMtx);
	int res = sqlite3_exec(this->_db, getNumOfCorrectAnswersQuery.c_str(), _getIntFromQuery, &correctQuestions, &errorMessage);
	answersLock.unlock();
	if (SQLITE_OK != res)
	{
		std::cout << errorMessage << "\n";
	}
	return correctQuestions;
}


int SqliteDatabase::getNumOfTotalAnswers(const std::string& username)
{
	std::string getNumOfTotalAnswersQuery = "SELECT SUM(questions_answered) FROM statistics WHERE username LIKE '" + username + "';";

	int totalAnswers = 0;
	char* errorMessage = nullptr;
	std::shared_lock<std::shared_mutex> answersLock(this->_statisticsTalbeMtx);
	int res= sqlite3_exec(this->_db, getNumOfTotalAnswersQuery.c_str(), _getIntFromQuery, &totalAnswers, &errorMessage);
	answersLock.unlock();
	if (SQLITE_OK != res)
	{
		std::cout << errorMessage << "\n";
	}
	return totalAnswers;
}


int SqliteDatabase::getNumOfPlayerGames(const std::string& username) 
{
	std::string getNumOfPlayerGamesQuery = "SELECT COUNT(username) FROM statistics WHERE username LIKE '" + username + "';";
	char* errorMessage = nullptr;
	int playerGames = 0;
	std::shared_lock<std::shared_mutex> gamesLock(this->_statisticsTalbeMtx);
	int res =sqlite3_exec(this->_db, getNumOfPlayerGamesQuery.c_str(), _getIntFromQuery, &playerGames, &errorMessage);
	gamesLock.unlock();
	if (SQLITE_OK != res) 
	{
		std::cout << errorMessage << "\n";
	}
	return playerGames;
}

bool SqliteDatabase::_insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer1, const std::string& wrong_answer2, const std::string& wrong_answer3) 
{
	std::string insertQuestionQuery = "INSERT INTO Question (question, right_answer, wrong_answer1, wrong_answer2,wrong_answer3) VALUES ('" + question + "','" + right_answer + "','" + wrong_answer1 + "','" + wrong_answer2 + "','" + wrong_answer3 + "');";
	char* error = nullptr;
	std::unique_lock<std::shared_mutex> guard(_questionsTableMtx);
	int res = sqlite3_exec(this->_db, insertQuestionQuery.c_str(), nullptr, nullptr, &error);
	guard.unlock();
	if (SQLITE_OK != res) 
	{
		std::cout << error << "\n";
	}
	return SQLITE_OK == res;
}
bool SqliteDatabase::insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer) 
{
	return this->_insertQuestion(question, right_answer, wrong_answer, "", "");
}
bool SqliteDatabase::insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer1, const std::string& wrong_answer2)
{
	return this->_insertQuestion(question, right_answer, wrong_answer1, wrong_answer2, "");
}

bool SqliteDatabase::insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer1, const std::string& wrong_answer2, const std::string& wrong_answer3) {

	return this->_insertQuestion(question, right_answer, wrong_answer1, wrong_answer2, wrong_answer3);
}
bool SqliteDatabase::insertStatistics(const std::string& username, const int gameId, const int questionsAnswered, const int correctlyAnsweredQuestions, const float avgTimeToAnswer) 
{
	int score = this->calculatePoints(questionsAnswered,correctlyAnsweredQuestions,avgTimeToAnswer);
	
	std::string insertStatisticsQuery = "INSERT INTO statistics (username, questions_answered , correctly_answered_questions,avg_time_to_answer,score,game_id) VALUES('" + username + "'," + std::to_string(questionsAnswered) + "," + std::to_string(correctlyAnsweredQuestions) + "," + std::to_string(avgTimeToAnswer) + "," + std::to_string(score) + "," + std::to_string(gameId) + ");";
	char* error = nullptr;
	std::unique_lock<std::shared_mutex> guard(this->_statisticsTalbeMtx);
	int res = sqlite3_exec(this->_db, insertStatisticsQuery.c_str(), nullptr, nullptr, &error);
	guard.unlock();
	if (SQLITE_OK != res) 
	{
		std::cout << error << "\n";
	}
	return SQLITE_OK != res;
}
#define TEN_QUESTIONS 10
#define WRONG_ANSWERS 3
#define MAX_LENGTH 50
#define MAX_QUESTION_LENGTH 100
void SqliteDatabase::insertTenRandomQuestions()
{
	char tenQuestions[TEN_QUESTIONS][MAX_QUESTION_LENGTH] =
	{
		"What was the number on Geralds shirt in Hey Arnold!",
		"Which of these albums is a Wu - Tang Clan album ?",
		"The Pyrenees mountains are located on the border of which two countries ?",
		"What is the main CPU is the Sega Mega Drive / Sega Genesis?",
		"In what dialogue did Socrates defend himself to the court of Athens?",
		"Which of the following presidents is not on Mount Rushmore?",
		"What Queen song plays during the final fight scene of the film Hardcore Henry?",
		"Who created the  Metal Gear Series ?",
		"The original ending of Little Shop Of Horrors has the plants taking over the world.",
		"Which of these is NOT a song featured on the Lockjaw EP released in 2013 by Flume & Chet Faker?",
	};
	 char correctAnswers[TEN_QUESTIONS][MAX_LENGTH]
	{
		"33",
		"Iron Flag",
		"France and Spain",
		"Motorola 68000",
		"The Apology",
		"John F. Kennedy",
		"Don\'t Stop Me Now",
		"Hideo Kojima",
		"True",
		"Left Alone"
	};
	 char wrongAnswers[TEN_QUESTIONS][WRONG_ANSWERS][MAX_LENGTH]
	{
		{"88","38","83"},
		{"Perfect Hair" ,"The Low End Theory" ,"Licensed to Ill"},
		{"Italy and Switzerland", "Norway and Sweden","Russia and Ukraine"},
		{"Zilog Z80", "Yamaha YM2612", "Intel 8088"},
		{"The Euthyphro", "The Laws", "The Republic"},
		{"Theodore Roosevelt", "Abraham Lincoln", "Thomas Jefferson"},
		{"Brighton Rock", "Another Bites the Dust", "We Will Rock You"},
		{"Hiroshi Yamauchi", "Shigeru Miyamoto", "Gunpei Yoko"},
		{"False","",""},
		{"What About Us", "This Song Is Not About A Girl", "Drop The Game"}
	};
	std::string question;
	std::string rightAnswer;
	std::string wrongAnswer;
	std::string wrongAnswer2;
	std::string wrongAnswer3;
	int i = 0, j = 0;
	for (i = 0; i < TEN_QUESTIONS; i++)
	{
		wrongAnswer="";
		wrongAnswer2="";
		wrongAnswer3="";
		question = tenQuestions[i];
		rightAnswer = correctAnswers[i];
		if (strcmp((const char*)wrongAnswers[i][0], "")) 
		{
			wrongAnswer = wrongAnswers[i][0];
		}
		if (strcmp((const char*)wrongAnswers[i][1], ""))
		{
			wrongAnswer2 = wrongAnswers[i][1];
		}
		if (strcmp((const char*)wrongAnswers[i][2], ""))
		{
			wrongAnswer3 = wrongAnswers[i][2];
		}
		this->insertQuestion(question,rightAnswer,wrongAnswer,wrongAnswer2,wrongAnswer3);
	}
}

int SqliteDatabase::_getUsername(void* data, int argc, char** argv, char** azColname) 
{
	if (0 == argc)
	{
		return 0;
	}
	std::string* username = (std::string*)data;
	*username =argv[0];
	return 0;
}
int SqliteDatabase::getPlayerPoints(const std::string& username) 
{
	std::string queryPoints = "SELECT SUM(score) FROM statistics WHERE username LIKE '" + username + "';";
	int points=0;
	char* errorMessage = nullptr;
	int result = 0;
	std::shared_lock<std::shared_mutex> statsLock(this->_statisticsTalbeMtx);
	result = sqlite3_exec(this->_db, queryPoints.c_str(), _getIntFromQuery, &points, &errorMessage);
	statsLock.unlock();
	if (SQLITE_OK != result) 
	{
		std::cout << errorMessage << "\n";
	}
	return points;
}
struct Player SqliteDatabase::getPlayerStats(const unsigned int playerOffset)
{
	struct Player playerStats;
	char* errorMessage = nullptr;
	int result = 0;
	std::string statsSelect = "SELECT username,SUM(score) AS point_sum FROM statistics GROUP BY score ORDER BY point_sum DESC  LIMIT 1 OFFSET " + std::to_string(playerOffset) + ";";
	std::string username = "";
	std::shared_lock<std::shared_mutex> statLock(this->_statisticsTalbeMtx,std::defer_lock);
	statLock.lock();
	result = sqlite3_exec(this->_db, statsSelect.c_str(),_getUsername,&username, &errorMessage);
	statLock.unlock();
	if (SQLITE_OK != result)
	{
		std::cout << errorMessage << "\n";
	}
	playerStats.points = this->getPlayerPoints(username);
	playerStats.username = username;
	
	return playerStats;
}


int SqliteDatabase::getNumberOfUsers() 
{
	std::string selectRowIdQuery = "SELECT COUNT(rowid) FROM User;";
	int numberOfUsers = 0,result=0;
	char* errorMessage;
	std::shared_lock<std::shared_mutex> usersLock(this->_databaseMtx);
	result = sqlite3_exec(this->_db, selectRowIdQuery.c_str(), _getIntFromQuery, &numberOfUsers, &errorMessage);
	usersLock.unlock();
	if (SQLITE_OK != result) 
	{
		std::cout << errorMessage <<"\n";
	}
	return numberOfUsers;
}
int SqliteDatabase::getNumberOfQuestions() 
{
	std::string countQuestionsQuery = "SELECT COUNT(rowid) FROM Question;";
	char* errorMessage = nullptr;
	int result = 0, questions = 0;
	std::shared_lock<std::shared_mutex> questionLock(this->_questionsTableMtx);
	result =sqlite3_exec(this->_db, countQuestionsQuery.c_str(), _getIntFromQuery, &questions, &errorMessage);
	questionLock.unlock();
	if (SQLITE_OK != result) 
	{
		std::cout << errorMessage << "\n";
	}
	return questions;
}
int SqliteDatabase::_getQuestion(void* data, int argc, char** argv, char** azColname) 
{
	if (0 == argc) 
	{
		return 0;
	}
	std::vector<Question>* questions =(std::vector<Question>*) data;
	std::vector<std::string> answers;
	int i = 0;
	for (i = 1; i < argc; i++) 
	{
		answers.push_back(argv[i]);
	}
	Question qs(argv[0], answers);
	questions->push_back(qs);
	return 0;
}
std::vector<Question> SqliteDatabase::getQuestionsForGame(const unsigned int roomQuestions) 
{
	std::vector<Question> questions;
	char* errorMessage = nullptr;
	int res = 0,numberOfQuestions = this->getNumberOfQuestions(),dev=1,questionId=0,i=0;
	std::string questionSelect = "SELECT * FROM Question WHERE rowid=";// 
	std::string questionIdSelect;
	dev = roomQuestions < numberOfQuestions ? roomQuestions: numberOfQuestions;
	bool nextIter = true;
	std::vector<int> existingQuestions;
	srand(time(NULL));
	while( i < dev)
	{
		nextIter = true;
		questionId=(rand() % dev + 1);
		for (auto val = existingQuestions.begin(); val != existingQuestions.end(); val++) 
		{
			if (*val == questionId) {
				nextIter = false;
			}
		}
		if (nextIter) 
		{
			i++;
			existingQuestions.push_back(questionId);
			questionIdSelect = questionSelect + std::to_string(questionId) + ";";
			std::shared_lock<std::shared_mutex> readQuestionLock(this->_questionsTableMtx);
			res= sqlite3_exec(this->_db, questionIdSelect.c_str(), _getQuestion,&questions, &errorMessage);
			readQuestionLock.unlock();
			if (SQLITE_OK != res) 
			{
				std::cout << errorMessage << "\n";
			}
		}
	}
	return questions;
}

int SqliteDatabase::getLastGamePlayed() 
{
	int res = 0, lastId = 0,res2=0;
	char* errorMessage = nullptr, *errorMessage2 = nullptr;
	std::string getLastGameIdQuery = "SELECT MAX(game_id) FROM Game;";
	std::string updateLastId = "UPDATE Game set game_id=";
	std::unique_lock<std::mutex> gameIdLock(this->_gameTableMtx);
	res =sqlite3_exec(this->_db, getLastGameIdQuery.c_str(), _getIntFromQuery, &lastId, &errorMessage);
	updateLastId += std::to_string(lastId+1);
	updateLastId += " WHERE game_id="+std::to_string(lastId)+";";
	res2 = sqlite3_exec(this->_db, updateLastId.c_str(), nullptr, nullptr , &errorMessage2);
	gameIdLock.unlock();
	if (SQLITE_OK != res)
	{
		std::cout << errorMessage << "\n";
	}
	if (SQLITE_OK != res2) 
	{
		std::cout << errorMessage2 << "\n";
	}
	return lastId;
}
int SqliteDatabase::updatePlayerStats(const std::string & username, const int gameId, const int questionsAnswered, const int correctlyAnsweredQuestions, const unsigned int avgTimeToAnswer)
{
	int score = this->calculatePoints(questionsAnswered, correctlyAnsweredQuestions, avgTimeToAnswer);
	std::string updateQuery = "UPDATE statistics SET questions_answered=" + std::to_string(questionsAnswered) + ",correctly_answered_questions=" + std::to_string(correctlyAnsweredQuestions) + " , avg_time_to_answer=" + std::to_string(avgTimeToAnswer) + ",score=" + std::to_string(score) + " WHERE game_id=" + std::to_string(gameId); +" AND username LIKE '" + username + "';";
	int res = 0;
	char* errorMessage = nullptr;
	res =sqlite3_exec(this->_db, updateQuery.c_str(), nullptr, nullptr, &errorMessage);
	if (SQLITE_OK != res) 
	{
		std::cout << errorMessage << "\n";
	}
	return 0;
}
int SqliteDatabase::calculatePoints(const int questionsAnswered, const int correctlyAnsweredQuestions, const unsigned int avgTimeToAnswer)
{
	int score = 0;
	if (0 == avgTimeToAnswer)
	{
		score = 100 * (correctlyAnsweredQuestions)-10 * (questionsAnswered - correctlyAnsweredQuestions) + questionsAnswered;
	}
	else
	{
		score = (int)(100 * (correctlyAnsweredQuestions / avgTimeToAnswer)) - 10 * (questionsAnswered - correctlyAnsweredQuestions) + questionsAnswered;
	}
	return score;
}
