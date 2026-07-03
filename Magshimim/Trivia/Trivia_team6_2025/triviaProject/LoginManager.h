#pragma once
#include "LoggedUser.h"
#include "IDatabase.h"
#include "LoginManagerStatus.h"
#include <mutex>
#include <shared_mutex>
#include <iostream>
#include <vector>
#include <string>
class LoginManager
{
public:
	LoginManager( IDatabase* db);
	~LoginManager();
	void logout(const std::string& username);
	SignUpStatus signup(const std::string& username, const std::string& password, const std::string& email);
	LoginStatus login(const std::string& username, const std::string& password);
	const IDatabase* getDatabase()const;
	const std::vector<LoggedUser>& getLoggedUsers()const;
private:
	IDatabase* m_database;
	std::vector<LoggedUser> m_loggedUsers;
	std::shared_mutex _usersMutex;
	
};

