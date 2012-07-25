// Hey there! I know how to install apps. Buttons are dumb now.

(function() {
    z.page.on('click', '.button.product', clickHandler);

    // Automatically launch the app for reviewers.
    $(window).on('app_install_success.reviewers', function(e, product, installedNow) {
        if (installedNow && location.pathname.indexOf('/reviewers/') > -1) {
            setTimeout(function() {
                startLaunch(product);
            }, 1000);
        }
    });

    function clickHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        var $this = $(this),
            product = $this.data('product');
        if ($this.hasClass('launch')) {
            startLaunch(product);
        } else {
            startInstall(product);
        }
    }

    function startLaunch(product) {
        if (!z.capabilities.webApps) {
            return;
        }
        var r = window.navigator.mozApps.getInstalled();
        r.onerror = function(e) {
            throw 'Error calling getInstalled: ' + r.error.name;
        };
        r.onsuccess = function() {
            z.apps = r.result;
            _.each(r.result, function(app) {
                if (app.manifestURL == product.manifestUrl) {
                    return app.launch();
                }
            });
        };
    }

    function startInstall(product) {
        if (z.anonymous && (!z.allowAnonInstalls || product.price)) {
            localStorage.setItem('toInstall', product.manifestUrl);
            $(window).trigger('login');
            return;
        }
        // Show "Install" button if I'm installing from the Reviewer Tools,
        // I already purchased this, or if it's free!
        if (location.pathname.indexOf('/reviewers/') > -1 ||
            product.isPurchased || !product.price) {
            install(product);
            return;
        }
        if (product.price) {
            purchase(product);
        }
    }

    function purchase(product) {
        $(window).trigger('app_purchase_start', product);
        $.when(z.payments.purchase(product))
         .done(purchaseSuccess)
         .fail(purchaseError);
    }

    function purchaseSuccess(product, receipt) {
        // Firefox doesn't successfully fetch the manifest unless I do this.
        $(window).trigger('app_purchase_success', [product]);
        setTimeout(function() {
            install(product);
        }, 0);
    }

    function purchaseError(product, msg) {
        $(window).trigger('app_purchase_error', [product, msg]);
    }

    function install(product, receipt) {
        var data = {};
        var post_data = {
            device_type: z.capabilities.getDeviceType()
        };
        if (z.capabilities.chromeless) {
            post_data.chromeless = 1;
        }

        $(window).trigger('app_install_start', product);
        $.post(product.recordUrl, post_data).success(function(response) {
            if (response.error) {
                $('#pay-error').show().find('div').text(response.error);
                installError(product);
                return;
            }
            if (response.receipt) {
                data.data = {'receipts': [response.receipt]};
            }
            $.when(apps.install(product, data))
             .done(installSuccess)
             .fail(installError);
        }).error(function(response) {
            // Could not record/generate receipt!
            installError(product);
        });
    }

    function installSuccess(product) {
        $(window).trigger('app_install_success', [product, true]);
        if (installedNow && location.pathname.indexOf('/reviewers/') > -1) {
            startLaunch(product);
        }

    }

    function installError(product, msg) {
        $(window).trigger('app_install_error', [product, msg]);
    }

    $(function() {
        if (localStorage.getItem('toInstall')) {
            var lsVal = localStorage.getItem('toInstall');
            localStorage.removeItem('toInstall');
            var product = $(format('.button[data-manifestUrl="{0}"]',
                                   lsVal)).data('product');
            if (product) {
                startInstall(product);
            }
        }
    });
})();
