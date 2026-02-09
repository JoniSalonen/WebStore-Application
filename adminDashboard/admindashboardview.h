#ifndef ADMINDASHBOARDVIEW_H
#define ADMINDASHBOARDVIEW_H

#include <QMainWindow>
#include <QWidget>
#include <QtNetwork/QNetworkAccessManager>
#include <QComboBox>
#include <QtCharts/QChartView>

QT_BEGIN_NAMESPACE
namespace Ui {
class AdminDashboardview;
}
QT_END_NAMESPACE

class AdminDashboardview : public QMainWindow
{
    Q_OBJECT

public:
    explicit AdminDashboardview(QWidget *parent = nullptr);
    ~AdminDashboardview();

private slots:
    void loadDashboard();
    void createChart();
    void loadChartData();
    void addProductWindow();

private:
    Ui::AdminDashboardview *ui;
    QNetworkAccessManager *manager;
    QComboBox *rangeBox;
    QChartView *chartView;
    QString getToken();

};

#endif // ADMINDASHBOARDVIEW_H
