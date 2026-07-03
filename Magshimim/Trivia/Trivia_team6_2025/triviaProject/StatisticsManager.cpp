#include <iostream>
#include "StatisticsManager.h"
enum TopPlayers:unsigned int  
{
	top1Player,
	top2Player,
	top3Player,
	top4Player,
	top5Player,
};
#define NUMBER_OF_TOP_USERS 5
StatisticsManager::StatisticsManager(IDatabase* db)
{
	this->m_database = db;
}
StatisticsManager::~StatisticsManager() 
{
}
std::vector<std::string> StatisticsManager::getHighScore()
{
	std::vector<std::string> topHighScorePlayers;
	std::vector<std::string> currPlayer;
	int numOfUsers = this->m_database->getNumberOfUsers(),i=0;

	numOfUsers = numOfUsers > NUMBER_OF_TOP_USERS?NUMBER_OF_TOP_USERS:numOfUsers;
	struct Player topPlayers[NUMBER_OF_TOP_USERS];
	for (i = 0; i < numOfUsers; i++) 
	{
		topPlayers[i] = this->m_database->getPlayerStats(i);
		currPlayer = this->_convertFromPlayerToStats(topPlayers[i]);
		topHighScorePlayers.insert(topHighScorePlayers.end(), currPlayer.begin(), currPlayer.end());
	}
	return topHighScorePlayers;
}
std::vector<std::string> StatisticsManager::_convertFromPlayerToStats(const struct Player& player) 
{
	std::vector<std::string> stats;
	stats.push_back(player.username);
	stats.push_back(std::to_string(player.points));
	return stats;
}
std::vector<std::string> StatisticsManager::getUserStatistics(std::string username)
{

	std::vector<std::string> userStatistics;
	
	userStatistics.push_back(std::to_string(m_database->getNumOfTotalAnswers(username)));
	userStatistics.push_back(std::to_string(m_database->getNumOfCorrectAnswers(username)));
	userStatistics.push_back(std::to_string(m_database->getPlayerAverageAnswerTime(username)));
	userStatistics.push_back(std::to_string(m_database->getNumOfPlayerGames(username)));

	return userStatistics;
}