#include "envcreator.h"

#include <QString>
#include <QFile>
#include <QDebug>

envCreator::envCreator() {
    createEnvFile(); // Always ensure url.txt exists when the object is constructed
}

// Reads and returns the base URL stored in url.txt.
// Returns an empty string if the file cannot be opened (e.g. first run before createEnvFile()).
QString envCreator::openEnv(){
    QFile file("url.txt");
    if(!file.open(QIODevice::ReadOnly))
        return "";

    return file.readAll();
}

// Writes the default backend URL to url.txt, creating the file if it does not exist.
// Overwrites any existing content — the URL is fixed at localhost:3000 for this build.
void envCreator::createEnvFile(){
    QFile file("url.txt");
    QString url("http://localhost:3000/");
    if(file.open(QIODevice::WriteOnly | QIODevice::Truncate)){
        file.write(url.toUtf8());
        file.close();
    }
}

// Reads the JWT written to token.txt after a successful login.
// Returns an empty string if the file does not exist (user not yet logged in).
// The token is attached as a Bearer header on every authenticated request.
QString envCreator::getToken(){
    QFile file("token.txt");
    if(!file.open(QIODevice::ReadOnly))
        return "";

    return file.readAll();
}
