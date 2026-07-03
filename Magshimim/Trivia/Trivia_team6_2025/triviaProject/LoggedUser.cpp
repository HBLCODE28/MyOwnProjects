#include "LoggedUser.h"
LoggedUser::LoggedUser(const std::string username)
{
	this->m_username = username;
}
LoggedUser::~LoggedUser()
{
}
std::string LoggedUser::getUsername()const 
{
	return this->m_username;
}
bool LoggedUser::operator<(const LoggedUser& user) const
{
	return this->m_username <user.m_username;
}
LoggedUser& LoggedUser::operator=(const LoggedUser& other)
{
	this->m_username = other.m_username;
	return *this;
}