#ifndef NEWPRODUCT_H
#define NEWPRODUCT_H

#include <QMainWindow>
#include <QWidget>
#include <QtNetwork/QNetworkAccessManager>
#include <QComboBox>
#include <QString>

QT_BEGIN_NAMESPACE
namespace Ui {
class NewProduct;
}
QT_END_MOC_NAMESPACE

class NewProduct : public QMainWindow
{
    Q_OBJECT

public:
    explicit NewProduct(QWidget *parent = nullptr);
    ~NewProduct();

private:
    Ui::NewProduct *ui;
    QNetworkAccessManager *manager;
    QComboBox *catBox;
    QComboBox *subCatBox;

private slots:
    void returnBackToAdminView();
    void productSelection();
    void createProduct();
    void updateProduct();
    void showBoxes();

    QString categorySelection();
    QString subcategorySelection();
    QString brandSelection();
};

#endif // NEWPRODUCT_H
