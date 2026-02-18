#include "envcreator.h"

#include <QString>
#include <QFile>
#include <QDebug>
envCreator::envCreator() {
    createEnvFile();

}

// Reads the env file and get the url saved
QString envCreator::openEnv(){
    QFile file("url.txt");
    if(!file.open(QIODevice::ReadOnly))
        return "";

    return file.readAll();
}

// Creates env file where the url is saved
void envCreator::createEnvFile(){
    QFile file("url.txt");
    QString url("http://localhost:3000/");
    if(file.open(QIODevice::WriteOnly | QIODevice::Truncate)){
        file.write(url.toUtf8());
        file.close();
    }
}

// gets the JWT token from file that it was writen in the login screen
QString envCreator::getToken(){
    QFile file("token.txt");
    if(!file.open(QIODevice::ReadOnly))
        return "";

    return file.readAll();
}
