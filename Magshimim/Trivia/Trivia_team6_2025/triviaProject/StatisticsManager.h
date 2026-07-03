#pragma once
#include "IRequestHandler.h"
#include "SqliteDatabase.h"
#include "IDatabase.h"
#include <string>
#include <vector>

class StatisticsManager
{
	private:
		IDatabase* m_database;
        std::vector<std::string> _convertFromPlayerToStats(const struct Player& player);
	public:
        StatisticsManager(IDatabase* db);
        ~StatisticsManager();
		std::vector<std::string> getHighScore();
		std::vector<std::string> getUserStatistics(std::string username);
};

/*
User (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    email TEXT NOT NULL
);

User_statistics (
    username TEXT PRIMARY KEY NOT NULL,
    questions_answered INT NOT NULL,
    correctly_answered_questions INT NOT NULL,
    avg_time_to_answer REAL NOT NULL,
    num_of_games INT NOT NULL
);
*/
