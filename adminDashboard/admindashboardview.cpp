#include "admindashboardview.h"
#include "ui_admindashboardview.h"
#include "envcreator.h"
#include "newproduct.h"
#include <QNetworkRequest>
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QFile>
#include <QLabel>
#include <QDebug>
#include <QComboBox>
#include <QtCharts/QChartView>
#include <QLineSeries>
#include <QVBoxLayout>
#include <QDateTimeAxis>
#include <QValueAxis>

static QString URL;

AdminDashboardview::AdminDashboardview(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::AdminDashboardview)
{
    ui->setupUi(this);
    setWindowTitle("Admin Dashboard");
    envCreator env;
    URL = env.openEnv();

    manager = new QNetworkAccessManager(this);
    // loads data when page is loaded first time
    loadDashboard();
    createChart();
    connect(ui->refreshButton, &QPushButton::clicked, this, &AdminDashboardview::loadDashboard);
    connect(rangeBox, &QComboBox::currentIndexChanged, this, &AdminDashboardview::loadChartData);
    connect(ui->addNewProduct, &QPushButton::clicked, this, &AdminDashboardview::addProductWindow);

    ui->addNewProduct->setText("Add new product");
    ui->refreshButton->setText("Refresh data");

}

AdminDashboardview::~AdminDashboardview()
{
    delete ui;
}

// loads the data to the admin dashboard from backend where it was prepared to use
void AdminDashboardview::loadDashboard(){

    QUrl url(URL + "admin/dashboard");
    QNetworkRequest request(url);

    QString token = getToken();
    qDebug() << token;
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());

    QNetworkReply *reply =manager->get(request);

    connect(reply, &QNetworkReply::finished, this, [this, reply](){

        if(reply->error() != QNetworkReply::NoError){
            ui->revenueLabel->setText("Revenue: ERROR");

            reply->deleteLater();
            return;
        }

        QByteArray raw = reply->readAll();
        qDebug() << "raw data recieved: " + raw;
        QJsonObject data = QJsonDocument::fromJson(raw).object();

        double revenue = data["revenue"].toDouble();
        int orders = data["orderCount"].toInt();
        int users = data["userCount"].toInt();

        ui->revenueLabel->setText("Revenue: " + QString::number(revenue, 'f',2) +" €");
        ui->orderdLabel->setText("Orders: " + QString::number(orders));
        ui->usersLabel->setText("Customers: " + QString::number(users));

        // Debug
        qDebug() << "HTTP STATUS:" << reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        qDebug() << "ERROR:" << reply->error();
        qDebug() << "RESPONSE:" << raw;

        reply->deleteLater();

    });
}

// creates chart widget and drop box widget
void AdminDashboardview::createChart(){

    QLineSeries *series = new QLineSeries();

    QChart *chart = new QChart();
    chart->addSeries(series);
    chart->createDefaultAxes();
    chart->setTitle("Sales Overview");

    // adds options to the dropbox widget
    rangeBox = new QComboBox;
    rangeBox->addItem("Last 24h", "today");
    rangeBox->addItem("Last 7 days", "week");
    rangeBox->addItem("Last month", "month");
    rangeBox->addItem("Last year", "year");

    chartView = new QChartView(chart);
    chartView->setRenderHint(QPainter::Antialiasing);

    QVBoxLayout *layout = new QVBoxLayout(ui->salesChartWidget);
    layout->setContentsMargins(0,0,0,0);
    layout->addWidget(chartView);
    layout->addWidget(rangeBox);

    loadChartData();

}

// loads the data to the chart widget
void AdminDashboardview::loadChartData(){
    QString range = rangeBox->currentData().toString();

    QUrl url(URL + "admin/sales/chart?range=" + range);
    QNetworkRequest request(url);
    QString token = getToken();

    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());

    QNetworkReply *reply = manager->get(request);

    connect(reply, &QNetworkReply::finished, this, [=]() {
        QByteArray raw = reply->readAll();
        QJsonDocument doc = QJsonDocument::fromJson(raw);
        QJsonArray arr = doc.array();

        QLineSeries *series = new QLineSeries();
        QChart *chart = new QChart();
        QDateTimeAxis *axisX = new QDateTimeAxis;
        QValueAxis *axisY = new QValueAxis;

        int index = 0;

        // gets the data to the chart from backend/database
        for (const auto &val : arr) {
            const QJsonObject obj = val.toObject();
            const double revenue = obj["revenue"].toDouble();
            const QString dateStr = obj["date"].toString();
            QDateTime dt = QDateTime::fromString(dateStr, "yyyy-MM-dd");
            dt.setTime(QTime(0,0));

            qint64 xValue= dt.toMSecsSinceEpoch();

            series->append(xValue,revenue);

            qDebug() << "chart points: " << dateStr << revenue;
        }

        // updates the charts data

        chart->addSeries(series);
        chart->createDefaultAxes( );
        chart->setTitle("Sales Revenue");

        axisX->setFormat("dd.MM");
        axisX->setTitleText("Date");

        axisY->setTitleText("Revenue (€)");

        chart->addAxis(axisX, Qt::AlignBottom);
        chart->addAxis(axisY, Qt::AlignLeft);

        series->attachAxis(axisX);
        series->attachAxis(axisY);

        chartView->setChart(chart);
        reply->deleteLater();
    });
}

// gets the JWT token from file that it was writen in the login screen
QString AdminDashboardview::getToken(){
    QFile file("token.txt");
    if(!file.open(QIODevice::ReadOnly))
        return "";

    return file.readAll();
}

// Opening new window to add new product to database
void AdminDashboardview::addProductWindow(){
    NewProduct *newProduct = new NewProduct();
    newProduct->show();
    this->close();
}
