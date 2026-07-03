#pragma once
#pragma warning(suppress : 4996)
#include "IDatabase.h"
#include "json.hpp"
//#include "SSLManager.h"
#include <string>
#include <vector>

#include <iostream>
using json = nlohmann::json;
#define OPEN_TDB_API_URL  "https://opentdb.com/api.php?amount="
#define MAX_QUESTIONS  15
#define MIN_QUESTIONS 10
#define OPEN_TDB_IP "173.236.198.186"
#define OPEN_TDB_REQUEST_API_PART_1 "GET /api.php?amount="
#define OPEN_TDB_REQUEST_API_PART_2 " HTTP/2"
#define OPEN_TDB_PORT 443
#define HEADERS_RESPONSE_LENGTH 303
#define MAX_JSON_CONTENT_LENGTH 5000 
#define OPEN_TDB_HOSTNAME "opentdb.com"
class TriviaQuestionsClient
{
private:
	
	int _questions;
	
	IDatabase* _db;
	
	std::string _apiRequest;
	
	json _response;
	
	std::vector<std::string> _questionsStr;
	//SSLManager _ssl;
	
	
	
	

public:
	TriviaQuestionsClient(IDatabase* db,int questions);
	~TriviaQuestionsClient();
	
	std::vector<std::string> getQuestions()const;

};

