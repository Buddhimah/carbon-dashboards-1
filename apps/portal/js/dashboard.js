/*
 * Copyright (c) 2015, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

$(function () {
    /**
     * Gadget default view mode.
     * @const
     */
    var DASHBOARD_DEFAULT_VIEW = 'default';
    /**
     * Dashboard anonymous view mode
     * @const
     */
    var DASHBOARD_ANON_VIEW = 'anon';
    /**
     * Gadget full screen mode.
     * @const
     */
    var DASHBOARD_FULL_SCEEN_VIEW = 'full';
    /**
     * Gadget settings view mode.
     * @const
     */
    var DASHBOARD_SETTINGS_VIEW = 'settings';
    /**
     * Gadget container prefix.
     * @const
     */
    var CONTAINER_PREFIX = 'gadget-';
    
    /**
     * RPC service name for gadget button callback.
     * @const
     */
    var RPC_GADGET_BUTTON_CALLBACK = "RPC_GADGET_BUTTON_CALLBACK";
    var DEFAULT_VIEW_NAME = 'loggedIn';
    var ANON_VIEW_NAME = 'anon';
    
    var page;
    var selectedViewId;
    /**
     * Pre-compiling Handlebar templates
     */
    var componentToolbarHbs = Handlebars.compile($('#ues-component-actions-hbs').html());
    var gadgetSettingsViewHbs = Handlebars.compile($('#ues-gadget-setting-hbs').html());
    var menuListHbs = Handlebars.compile($("#ues-menu-list-hbs").html());
    var viewOptionHbs = Handlebars.compile($("#view-option-hbs").html());

    /**
     * Initializes the component toolbar.
     * @return {null}
     * @private
     */
    var initComponentToolbar = function () {
        var viewer = $('.ues-components-grid');

        // gadget title bar custom button function handler
        viewer.on('click', '.ues-custom-action', function (e) {
            var fid = $(this).closest('.ues-component-box').find('iframe').attr('id');
            var action = $(this).attr('data-action');
            gadgets.rpc.call(fid, RPC_GADGET_BUTTON_CALLBACK, null, action);
        });

        // gadget maximization handler
        viewer.on('click', '.ues-component-full-handle', function (e) {
            var id = $(this).closest('.ues-component').attr('id');
            var component = ues.dashboards.findComponent(id, page);
            var componentBox = $(this).closest('.ues-component-box');
            var gsContainer = $('.grid-stack');
            var gsBlock = componentBox.parent();
            if (component.fullViewPoped) {
                // render normal view
                $('.ues-component-box').show();
                $('.sidebar-wrapper').show();
                // restore the original height and remove the temporary attribute
                gsContainer.height(gsContainer.attr('data-orig-height')).removeAttr('data-orig-height');
                gsBlock.removeClass('ues-component-fullview');
                renderMaxView(component, DASHBOARD_DEFAULT_VIEW);
                // modify the tooltip message and the maximize icon
                $(this)
                    .attr('title', $(this).data('maximize-title'))
                    .find('i.fw')
                    .removeClass('fw-contract')
                    .addClass('fw-expand');
                component.fullViewPoped = false;
            } else {
                // render max view
                $('.ues-component-box:not([id="' + componentBox.attr('id') + '"])').hide();
                $('.sidebar-wrapper').hide();
                // backup the origin height and render the max view
                gsContainer.attr('data-orig-height', gsContainer.height()).height('auto');
                gsBlock.addClass('ues-component-fullview');
                renderMaxView(component, DASHBOARD_FULL_SCEEN_VIEW);
                // modify the tooltip message and the maximize icon
                $(this)
                    .attr('title', $(this).data('minimize-title'))
                    .find('i.fw')
                    .removeClass('fw-expand')
                    .addClass('fw-contract');
                component.fullViewPoped = true;
            }
            $('.nano').nanoScroller();
        });

        // gadget settings handler
        viewer.on('click', '.ues-component-settings-handle', function (event) {
            event.preventDefault();
            var id = $(this).closest('.ues-component').attr('id');
            var component = ues.dashboards.findComponent(id, page);
            var componentContainer = $('#' + CONTAINER_PREFIX + id);
            // toggle the component settings view if exists
            if (component.hasCustomUserPrefView) {
                switchComponentView(component, (component.viewOption == DASHBOARD_SETTINGS_VIEW ?
                    DASHBOARD_DEFAULT_VIEW : DASHBOARD_SETTINGS_VIEW));
                return;
            }
            if (componentContainer.hasClass('ues-userprep-visible')) {
                componentContainer.removeClass('ues-userprep-visible');
                updateComponentProperties(componentContainer.find('.ues-sandbox'), component);
                return;
            }
            componentContainer.html(gadgetSettingsViewHbs(component.content)).addClass('ues-userprep-visible');
        });
    };

    /**
     * Switch component view mode
     * @param {Object} component
     * @param {String} view
     * @returns {null}
     * @private
     */
    var switchComponentView = function (component, view) {
        component.viewOption = view;
        ues.components.update(component, function (err, block) {
            if (err) {
                throw err;
            }
        });
    };

    /**
     * Render maximized view for a gadget
     * @param {Object} component
     * @param {String} view
     * @returns {null}
     * @private
     */
    var renderMaxView = function (component, view) {
        component.viewOption = view;
        ues.components.update(component, function (err, block) {
            if (err) {
                throw err;
            }
        });
    };
    /**
     * Renders the component toolbar of a given component.
     * @param {Object} component Component object
     * @returns {null}
     * @private
     */
    var renderComponentToolbar = function (component) {
        if (component) {
            // Check whether any user preferences are exists
            var userPrefsExists = false;
            for (var key in component.content.options) {
                if (component.content.options[key].type.toUpperCase() != 'HIDDEN') {
                    userPrefsExists = true;
                    break;
                }
            }

            // Validate and build the toolbar button options to be passed to the handlebar template
            var toolbarButtons = component.content.toolbarButtons || {};
            toolbarButtons.custom = toolbarButtons.custom || [];
            toolbarButtons.default = toolbarButtons.default || {};
            if (!toolbarButtons.default.hasOwnProperty('maximize')) {
                toolbarButtons.default.maximize = true;
            }
            if (!toolbarButtons.default.hasOwnProperty('configurations')) {
                toolbarButtons.default.configurations = true;
            }

            //check whether the view is an anonymous view
            var viewRoles;
            if(ues.global.dbType === 'default') {
                viewRoles = page.layout.content.loggedIn.roles;
            } else {
                viewRoles = page.layout.content[ues.global.dbType].roles;
            }

            var isAnonView = false;
            if (ues.global.dbType === 'anon') {
                if (viewRoles === undefined) {
                    isAnonView = true;
                }
            }
            if (viewRoles !== undefined && (viewRoles.length > 0 && viewRoles[0] === 'anonymous')) {
                isAnonView = true;
            }

            toolbarButtons.default.configurations = toolbarButtons.default.configurations && userPrefsExists && !isAnonView;
            for (var i = 0; i < toolbarButtons.custom.length; i++) {
                toolbarButtons.custom[i].iconTypeCSS = (toolbarButtons.custom[i].iconType.toLowerCase() == 'css');
                toolbarButtons.custom[i].iconTypeImage = (toolbarButtons.custom[i].iconType.toLowerCase() == 'image');
            }

            var buttonCount = toolbarButtons.custom.length;
            if (toolbarButtons.default.maximize) {
                buttonCount++;
            }
            if (toolbarButtons.default.configurations) {
                buttonCount++;
            }
            toolbarButtons.isDropdownView = buttonCount > 3;

            var componentBox = $('#' + component.id);
            // Set the width of the gadget heading
            var buttonUnitWidth = 41;
            var headingWidth = 'calc(100% - ' + ((buttonCount > 3 ? 1 : buttonCount) * buttonUnitWidth + 25)  + 'px)';
            componentBox.find('.gadget-title').css('width', headingWidth);
            // Render the gadget template
            componentBox.find('.ues-component-actions').html(componentToolbarHbs(toolbarButtons));
        }
    };

    /**
     * Returns the list of allowed views for the current user
     * @param page Current page
     * @returns {Array} List of allowe roles
     */
    var gerUserAllowedViews = function (page) {
        $('#ds-allowed-view-list').empty();
        var allowedViews = [];
        var pageViews = JSON.parse(JSON.stringify(page.layout.content));
        var viewKeysArray = Object.keys(pageViews);
        var viewsArrayLength = viewKeysArray.length;

        for (var i = 0; i < viewsArrayLength; i++) {
            var viewRoles = page.layout.content[viewKeysArray[i]].roles;
            if (!viewRoles) {
                if (viewKeysArray[i] === 'loggedIn') {
                    viewRoles = ["Internal/everyone"];
                } else if (viewKeysArray[i] === DASHBOARD_ANON_VIEW) {
                    viewRoles = ["anonymous"];
                }
            } else if(viewRoles.length === 0){
                viewRoles = ["Internal/everyone"];
            }
            if (isAllowedView(viewRoles)) {
                allowedViews.push(viewKeysArray[i]);
                var tempViewName = page.layout.content[viewKeysArray[i]].name;
                if (!tempViewName) {
                    if (viewKeysArray[i] === 'loggedIn') {
                        tempViewName = DEFAULT_VIEW_NAME;
                    } else if (viewKeysArray[i] === DASHBOARD_ANON_VIEW) {
                        tempViewName = ANON_VIEW_NAME;
                    }
                }
                var viewOption = {
                    viewName: tempViewName
                };
                $('#ds-allowed-view-list').append(viewOptionHbs(viewOption)).unbind('change').on('change', function () {
                    var selectedView = $('#ds-allowed-view-list option:selected').text();
                    selectedView = selectedView.trim();
                    var previousSelectedView = selectedViewId || ues.global.dbType;
                    selectedViewId = getViewId(selectedView);

                    if (!selectedViewId) {
                        if (viewKeysArray[i] === DEFAULT_VIEW_NAME) {
                            selectedViewId = DASHBOARD_DEFAULT_VIEW;
                        } else if (viewKeysArray[i] === ANON_VIEW_NAME) {
                            selectedViewId = DASHBOARD_ANON_VIEW;
                        }
                    }

                    ues.global.dbType = selectedViewId;
                    destroyPage(page, previousSelectedView);
                    ues.dashboards.render($('.gadgets-grid'), ues.global.dashboard, ues.global.page, selectedViewId,
                        function () {
                            $('.ues-component-box .ues-component').each(function () {
                                var component = ues.dashboards.findComponent($(this).attr('id'), page);
                                renderComponentToolbar(component);
                            });
                            $('.grid-stack').gridstack({
                                width: 12,
                                cellHeight: 50,
                                verticalMargin: 30,
                                disableResize: true,
                                disableDrag: true,
                            });
                    });
                });
            }
        }
        return allowedViews;
    };

    /**
     * Destroys all areas in a given page.
     * @param {Object} page     The page object
     * @param {String} pageType Type of the page
     * @param {function} done   Callback function
     * @return {null}
     * @private
     */
    var destroyPage = function (page, pageType, done) {
        var area;
        pageType = pageType || DEFAULT_DASHBOARD_VIEW;
        var content = page.content[pageType];
        var tasks = [];
        for (area in content) {
            if (content.hasOwnProperty(area)) {
                tasks.push((function (area) {
                    return function (done) {
                        destroyArea(area, function (err) {
                            done(err);
                        });
                    };
                }(content[area])));
            }
        }
        async.parallel(tasks, function (err, results) {
            $('.gadgets-grid').empty();
            if (!done) {
                return;
            }

            done(err);
        });
    };

    /**
     * Destroys a given list of components of an area.
     * @param {Object[]} components Components to be removed
     * @param {function} done       Callback function
     * @return {null}
     * @private
     */
    var destroyArea = function (components, done) {
        var i;
        var length = components.length;
        var tasks = [];
        for (i = 0; i < length; i++) {
            tasks.push((function (component) {
                return function (done) {
                    destroyComponent(component, function (err) {
                        done(err);
                    });
                };
            }(components[i])));
        }
        async.parallel(tasks, function (err, results) {
            done(err);
        });
    };

    /**
     * Destroys the given component.
     * @param {Object} component    Component to be destroyed
     * @param {function} done       Callback function
     * @return {null}
     * @private
     */
    var destroyComponent = function (component, done) {
        ues.components.destroy(component, function (err) {
            if (err) {
                return err;
            }
            done(err);
        });
    };

    /**
     * Returns view id when the view name is given
     * @param viewName View name
     * @returns {String} View id
     */
    var getViewId = function (viewName) {
        var viewArray = Object.keys(JSON.parse(JSON.stringify(page.layout.content)));
        var viewArrayLength = viewArray.length;

        for (var i = 0; i < viewArrayLength; i++) {
            if (page.layout.content[viewArray[i]].name !== undefined) {
                if (page.layout.content[viewArray[i]].name === viewName) {
                    return viewArray[i];
                }
            }
        }
        return null;
    };

    /**
     * Check whether a view is allowed for the current user
     * according to his/her list of roles
     * @param viewRoles Allowed roles list for the view
     * @returns {boolean} View is allowed or not
     */
    var isAllowedView = function (viewRoles) {
        var userRolesLength = userRolesList.length;
        if (viewRoles === undefined) {

        }
        var viewRolesLength = viewRoles.length;
        for (var i = 0; i < userRolesLength; i++) {
            var tempUserRole = userRolesList[i];
            for (var j = 0; j < viewRolesLength; j++) {
                if (viewRoles[j] === tempUserRole) {
                    return true;
                }
            }
        }
        return false;
    };

    //compile handlebar for the menu list
    var updateMenuList = function() {
        //menulist for big res
        $('#ues-pages').html(menuListHbs({
            menu: ues.global.dashboard.menu,
            isAnonView: isAnonView,
            user: user,
            isHiddenMenu: ues.global.dashboard.hideAllMenuItems,
            queryString: queryString
        }));
        //menulist for small res
        $('#ues-pages-col').html(menuListHbs({
            menu: ues.global.dashboard.menu,
            isAnonView: isAnonView,
            user: user,
            isHiddenMenu: ues.global.dashboard.hideAllMenuItems,
            queryString: queryString
        }));
    };

    /**
     * This is the initial call from the dashboard.js.
     * @return {null}
     * @private
     */
    var initDashboard = function () {
        var allPages = ues.global.dashboard.pages;
        if (allPages.length > 0) {
            page = (ues.global.page ? ues.global.page : allPages[0]);
        }
        for (var i = 0; i < allPages.length; i++) {
            if (ues.global.page == allPages[i].id) {
                page = allPages[i];
            }
        }
        var allowedViews = gerUserAllowedViews(page);
        var renderingView;
        if (allowedViews.length > 0) {
            renderingView = allowedViews[0];
        }
        //if there is more than one view, enable dropdown list
        if (allowedViews.length > 1) {
            $('#list-user-views').removeClass("hide");
            $('#list-user-views').removeClass("show");
        }
        if(renderingView === 'loggedIn') {
            renderingView = 'default';
        }
        ues.global.dbType = renderingView;
        ues.dashboards.render($('.gadgets-grid'), ues.global.dashboard, ues.global.page, renderingView, function () {
            // render component toolbar for each components
            $('.ues-component-box .ues-component').each(function () {
                var component = ues.dashboards.findComponent($(this).attr('id'),page);
                renderComponentToolbar(component);
            });
            $('.grid-stack').gridstack({
                width: 12,
                cellHeight: 50,
                verticalMargin: 30,
                disableResize: true,
                disableDrag: true,
            });
        });
        $('.nano').nanoScroller();
    };

    initDashboard();
    updateMenuList();
    initComponentToolbar();
});

/**
 * We make this true so that the dashboard.jag files inline ues.dashboards.render method is not triggered.
 * @type {boolean}
 */
ues.global.renderFromExtension = true;
