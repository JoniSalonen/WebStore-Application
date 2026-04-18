#include "adminlogin.h"
#include "./ui_adminlogin.h"
#include "admindashboardview.h"
#include "envcreator.h"
#include <QNetworkRequest>
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QFile>
#include <QDebug>
#include <QLineEdit>
#include <QMessageBox>
#include <QLabel>
#include <QMessageBox>

static QString URL; // Base URL read from url.txt at startup

AdminLogin::AdminLogin(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::AdminLogin)
{
    ui->setupUi(this);
    setWindowTitle("Login window");

    envCreator env;
    // Ensure url.txt exists with the default localhost address, then read it
    env.createEnvFile();
    URL = env.openEnv();

    manager = new QNetworkAccessManager(this);

    connect(ui->loginBtn, &QPushButton::clicked, this, &AdminLogin::login);

    ui->emailEdit->setPlaceholderText("Email");

    ui->passwordEdit->setPlaceholderText("Password");
    ui->passwordEdit->setEchoMode(QLineEdit::Password); // Masks characters as the user types

    // Pre-filled for development convenience — remove before production
    ui->emailEdit->setText("a@a.com");
    ui->passwordEdit->setText("123456");
}

AdminLogin::~AdminLogin()
{
    delete ui;
}

// Sends the email and password to POST /auth/login.
// On success the returned JWT is written to token.txt so every other
// window can read it via envCreator::getToken().
// On failure a warning dialog is shown and the window stays open.
void AdminLogin::login(){
    QUrl url(URL + "auth/login");

    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    QJsonObject body;
    body["email"]    = ui->emailEdit->text();
    body["password"] = ui->passwordEdit->text();

    QNetworkReply *reply = manager->post(request, QJsonDocument(body).toJson());

    connect(reply, &QNetworkReply::finished, this, [=](){
        auto response = QJsonDocument::fromJson(reply->readAll()).object();
        QString token = response["accessToken"].toString();

        if(!token.isEmpty()){
            // Persist the JWT to disk so all subsequent requests can attach it
            QFile file("token.txt");
            if(file.open(QIODevice::WriteOnly | QIODevice::Truncate)){
                file.write(token.toUtf8());
                file.close();
            }

            AdminDashboardview *dashboard = new AdminDashboardview();
            dashboard->show();
            this->close(); // Close login window after successful authentication
        } else {
            QMessageBox::warning(this, "Login Failed", "Wrong Email or password");
        }

        reply->deleteLater();
    });
}
