#pragma once
#include <string>
class LoggedUser
{
private:
	std::string m_username;
public:
	LoggedUser(const std::string username);
	~LoggedUser();
	std::string getUsername()const;
	bool operator<(const LoggedUser& user)const;
	LoggedUser& operator=(const LoggedUser& other);
};

