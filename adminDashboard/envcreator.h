#ifndef ENVCREATOR_H
#define ENVCREATOR_H

#include <QString>

class envCreator
{
public:
    envCreator();

public slots:
    QString openEnv();
    void createEnvFile();

};

#endif // ENVCREATOR_H
