#include "envcreator.h"

#include <QString>
#include <QFile>
#include <QDebug>
envCreator::envCreator() {
    createEnvFile();

}

QString envCreator::openEnv(){
    QFile file("url.txt");
    if(!file.open(QIODevice::ReadOnly))
        return "";

    return file.readAll();
}

void envCreator::createEnvFile(){
    QFile file("url.txt");
    QString url("http://localhost:3000/");
    if(file.open(QIODevice::WriteOnly | QIODevice::Truncate)){
        file.write(url.toUtf8());
        file.close();
    }
}
