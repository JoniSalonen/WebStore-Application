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

// Module-level statics shared across all methods in this file
static QString URL;    // Base URL loaded from url.txt
static envCreator env; // Reads token and URL from local files

AdminDashboardview::AdminDashboardview(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::AdminDashboardview)
{
    ui->setupUi(this);
    setWindowTitle("Admin Dashboard");

    URL = env.openEnv();

    manager = new QNetworkAccessManager(this); // Handles all HTTP requests for this window

    // Load summary stats and build the chart on startup
    loadDashboard();
    createChart();

    // Refresh button reloads the summary labels (revenue, orders, users)
    connect(ui->refreshButton, &QPushButton::clicked, this, &AdminDashboardview::loadDashboard);

    // Changing the time-range dropdown reloads the chart data
    connect(rangeBox, &QComboBox::currentIndexChanged, this, &AdminDashboardview::loadChartData);

    connect(ui->addNewProduct, &QPushButton::clicked, this, &AdminDashboardview::addProductWindow);

    ui->addNewProduct->setText("Add new product");
    ui->refreshButton->setText("Refresh data");
}

AdminDashboardview::~AdminDashboardview()
{
    delete ui;
}

// Fetches summary data from GET /admin/dashboard and updates the
// revenue, order count and user count labels.
void AdminDashboardview::loadDashboard(){

    QUrl url(URL + "admin/dashboard");
    QNetworkRequest request(url);

    // JWT is required — the admin/dashboard endpoint is protected by RolesGuard
    QString token = env.getToken();
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());

    QNetworkReply *reply = manager->get(request);

    connect(reply, &QNetworkReply::finished, this, [this, reply](){

        if(reply->error() != QNetworkReply::NoError){
            ui->revenueLabel->setText("Revenue: ERROR");
            reply->deleteLater();
            return;
        }

        QByteArray raw = reply->readAll();
        qDebug() << "raw data recieved: " + raw;
        QJsonObject data = QJsonDocument::fromJson(raw).object();

        // Extract totals from the JSON and format them for display
        double revenue = data["revenue"].toDouble();
        int orders     = data["orderCount"].toInt();
        int users      = data["userCount"].toInt();

        ui->revenueLabel->setText("Revenue: " + QString::number(revenue, 'f', 2) + " €");
        ui->orderdLabel->setText("Orders: "   + QString::number(orders));
        ui->usersLabel->setText("Customers: " + QString::number(users));

        qDebug() << "HTTP STATUS:" << reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        qDebug() << "ERROR:"    << reply->error();
        qDebug() << "RESPONSE:" << raw;

        reply->deleteLater();
    });
}

// Creates the chart widget and the time-range dropdown and adds both to the
// salesChartWidget container defined in the .ui file.
// An initial chart data load is triggered at the end.
void AdminDashboardview::createChart(){

    // Placeholder series — createDefaultAxes() needs at least the chart object
    QLineSeries *series = new QLineSeries();
    QChart *chart = new QChart();
    chart->createDefaultAxes();
    chart->setTitle("Sales Overview");

    // Dropdown lets the user switch between 24 h / 7 d / 1 month / 1 year views
    rangeBox = new QComboBox;
    rangeBox->addItem("Last 24h",   "today");
    rangeBox->addItem("Last 7 days","week");
    rangeBox->addItem("Last month", "month");
    rangeBox->addItem("Last year",  "year");

    chartView = new QChartView(chart);
    chartView->setRenderHint(QPainter::Antialiasing); // Smooth line rendering

    // Stack the chart above the dropdown inside the placeholder widget
    QVBoxLayout *layout = new QVBoxLayout(ui->salesChartWidget);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->addWidget(chartView);
    layout->addWidget(rangeBox);

    // Load real data for the default range (Last 24h)
    loadChartData();
}

// Fetches daily revenue data from GET /admin/sales/chart?range=<range>
// and rebuilds the chart with proper date and value axes.
void AdminDashboardview::loadChartData(){
    // Read the data value stored on the current dropdown item (e.g. "today", "week")
    QString range = rangeBox->currentData().toString();

    QUrl url(URL + "admin/sales/chart?range=" + range);
    QNetworkRequest request(url);
    QString token = env.getToken();
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());

    QNetworkReply *reply = manager->get(request);

    connect(reply, &QNetworkReply::finished, this, [=]() {
        QByteArray raw = reply->readAll();
        QJsonDocument doc = QJsonDocument::fromJson(raw);
        QJsonArray arr = doc.array();

        // Build a fresh series and chart for every reload so old data is replaced
        QLineSeries *series = new QLineSeries();
        QChart *chart = new QChart();
        QDateTimeAxis *axisX = new QDateTimeAxis;
        QValueAxis *axisY = new QValueAxis;

        for (const auto &val : arr) {
            const QJsonObject obj = val.toObject();
            const double revenue    = obj["revenue"].toDouble();
            const QString dateStr   = obj["date"].toString();

            // Parse the date string returned by the backend (format: "yyyy-MM-dd")
            QDateTime dt = QDateTime::fromString(dateStr, "yyyy-MM-dd");
            dt.setTime(QTime(0, 0));

            // QLineSeries works with milliseconds since epoch on the X axis
            series->append(dt.toMSecsSinceEpoch(), revenue);

            qDebug() << "chart points: " << dateStr << revenue;
        }

        chart->addSeries(series);
        chart->createDefaultAxes(); // Creates default axes before we attach custom ones
        chart->setTitle("Sales Revenue");

        // Configure the date axis — "dd.MM" shows day and month without year
        axisX->setFormat("dd.MM");
        axisX->setTitleText("Date");
        axisY->setTitleText("Revenue (€)");

        chart->addAxis(axisX, Qt::AlignBottom);
        chart->addAxis(axisY, Qt::AlignLeft);

        // Axes must be attached to the series after being added to the chart
        series->attachAxis(axisX);
        series->attachAxis(axisY);

        // Replace the existing chart view contents with the newly built chart
        chartView->setChart(chart);
        reply->deleteLater();
    });
}

// Opens the Add New Product window and closes the dashboard.
void AdminDashboardview::addProductWindow(){
    NewProduct *newProduct = new NewProduct();
    newProduct->show();
    this->close();
}
