#ifndef NEWPRODUCT_H
#define NEWPRODUCT_H

#include <QMainWindow>

namespace Ui {
class NewProduct;
}

class NewProduct : public QMainWindow
{
    Q_OBJECT

public:
    explicit NewProduct(QWidget *parent = nullptr);
    ~NewProduct();

private:
    Ui::NewProduct *ui;

private slots:
    void returnBackToAdminView();
};

#endif // NEWPRODUCT_H
