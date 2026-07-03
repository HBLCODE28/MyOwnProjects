#include "SSLManager.h"
#include <openssl/applink.c>

SSLManager::SSLManager()
{
	this->_port = 0;
	this->_serSock = 0;
	this->_ssl_socket = 0;
	this->_ssl = nullptr;
	this->out = nullptr;
	this->web = nullptr;
	this->ctx = nullptr;
	this->_ipAddr = nullptr;
}
SSLManager::~SSLManager() 
{
	this->CloseConnection();
}

bool SSLManager::initSecureConnection() 
{
	SSL_library_init();
	SSLeay_add_ssl_algorithms();
	SSL_load_error_strings();
	int res = 0;
	const SSL_METHOD* met = TLS_client_method(); // specifying TLS versions 1.0-3
	this-> ctx = SSL_CTX_new(met);
	if (nullptr == ctx) {
		return false;
	}
	
	SSL_CTX_set_verify(this->ctx, SSL_VERIFY_PEER, nullptr);
	this->web = BIO_new_ssl_connect(this->ctx);
	if (nullptr == web)
	{
		return false;
	}
	std::string hostname = this->_ipAddr + std::string(":") + std::to_string(this->_port);
	res = BIO_set_conn_hostname(this->web,hostname.c_str());
	if (1 != res) 
	{
		return false;
	}
	BIO_get_ssl(this->web, &this->_ssl);
	if (nullptr == this->_ssl)
	{
		return false;
	}
	res = SSL_set_tlsext_host_name(this->_ssl, this->_hostname.c_str());
	if (1 != res)
	{
		return false;
	}

	this->out = BIO_new_fp(stdout, BIO_NOCLOSE);
	if (nullptr == this->out) {
		return false;
	}
	res = BIO_do_connect(this->web);
	if (1 != res)
	{
		return false;
	}
	res = BIO_do_handshake(this->web); 
	if (1 != res)
	{
		return false;
	}
		
	X509* cert = SSL_get_peer_certificate(this->_ssl);
	if (nullptr == cert)
	{
		return false;
	}
	X509_free(cert);
	cert = nullptr;
	res = SSL_get_verify_result(this->_ssl);
	if (X509_V_OK != res)
	{
		return false;
	}
	
	return true;
	
}
bool SSLManager::connectToServer( std::string hostname, const char* ipAddr , const int port)
{
	this->_hostname =hostname;
	this->_port = port;
	if(nullptr == ipAddr){
	return true;
	}
	
	this->_ipAddr = ipAddr;
	return true;
}
bool SSLManager::sendRequest(const char* buffer,int length) 
{
	BIO_write(this->web, buffer, length);
	
	return true;

}
bool SSLManager::CloseConnection()
{
	if (nullptr != this->out)
	{
		BIO_free(this->out);
		this->out = nullptr;
	}
	if (nullptr != this->web) {
		BIO_free_all(this->web);
		this->web = nullptr;
	}
	if (nullptr != this->ctx)
	{
		SSL_CTX_free(this->ctx);
		this->ctx = nullptr;
	}
	return true;
}
std::vector<unsigned char> SSLManager::recieveResponse(const int bytes) 
{

	char* headerBuffer = new char[bytes+1];
	headerBuffer[bytes] = 0;
	BIO_read(this->web, headerBuffer, bytes);
	std::cout << headerBuffer << "\n";
	delete[] headerBuffer;
	
	 std::vector<unsigned char>vec;
	 return vec;
}