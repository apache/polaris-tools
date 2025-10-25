/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/
import React, { useState, useEffect } from 'react';
import { Layout, Input, Col, Row, Image, Menu, Space, Spin, message } from 'antd';
import { Route, Switch } from 'react-router';
import { BrowserRouter as Router } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { HomeOutlined, UserOutlined, BlockOutlined, SettingOutlined, DeleteOutlined, MenuUnfoldOutlined, PlayCircleOutlined, LogoutOutlined, ApartmentOutlined, DashboardOutlined, AreaChartOutlined, NotificationOutlined, SafetyOutlined, TeamOutlined, BuildOutlined, CrownOutlined, ProfileOutlined, CheckSquareOutlined, PlusCircleOutlined } from '@ant-design/icons';
import Home from './home.tsx';
import Catalog from './catalog.tsx';
import Browse from './browse.tsx';
import Principals from './principals.tsx';
import Settings from './settings.tsx';

function SideMenu(props) {

    const[ collapsed, setCollapsed ] = useState(false);

    const catalogElementsMenu = props.catalogs.map((element) => {
        const configLink = "/catalog/" + element.name;
        const browseLink = "/browse/" + element.name;
        return({
           key: element.name,
           label: element.name,
           icon: <ApartmentOutlined/>,
           children: [
               { key: browseLink, label: <Link to={browseLink}>Browse</Link>, icon: <MenuUnfoldOutlined/> },
               { key: configLink, label: <Link to={configLink}>Configuration</Link>, icon: <SettingOutlined/> }
           ]
        });
    });
    const newCatalogMenu = [
        {
            key: 'catalog/create',
            label: <Link to="/catalog/create">Create</Link>,
            icon: <PlusCircleOutlined/>,
        }
    ];

    const catalogMenu = newCatalogMenu.concat(catalogElementsMenu);

    const mainMenu = [
        { key: 'home', label: <Link to="/">Home</Link>, icon: <HomeOutlined/> },
        { key: 'catalogs', label: 'Catalogs', icon: <BlockOutlined/>, children: catalogMenu },
        { key: 'governance', label: 'Governance', icon: <SafetyOutlined/>, children: [
            { key: 'principals', label: <Link to="/principals">Principals</Link>, icon: <UserOutlined/> },
            { key: 'principal_roles', label: 'Principal Roles', icon: <TeamOutlined/> },
            { key: 'catalog_roles', label: 'Catalog Roles', icon: <BuildOutlined/> },
            { key: 'privileges', label: 'Privileges', icon: <CrownOutlined/> }
        ]},
        { key: 'settings', label: <Link to="/settings">Settings</Link>, icon: <SettingOutlined/> }
    ];

    return(
        <Layout.Sider collapsible={true} collapsed={collapsed} onCollapse={newValue => setCollapsed(newValue)}>
            <Menu items={mainMenu} mode="inline" defaultOpenKeys={[ 'catalogs', 'governance' ]}/>
        </Layout.Sider>
    );

}

function Header(props) {

    const { Search } = Input;

    const userMenu = [
        { key: 'user', label: props.user, icon: <UserOutlined/>, children: [
            { key: 'logout', label: 'Logout', icon: <LogoutOutlined/> }
        ] }
    ];

    return(
        <Layout.Header style={{ height: "80px", background: "#fff", padding: "5px", margin: "10px" }}>
            <Row align="middle" justify="center" wrap="false">
                <Col span={3}><Image src="/logo.png" preview={false} width={50}/></Col>
                <Col span={19}><Search /></Col>
                <Col span={2}><Menu items={userMenu} onClick={(e) => {
                    if (e.key === 'logout') {
                        props.setUser(null);
                    }
                }} /></Col>
            </Row>
        </Layout.Header>
    );

}

export default function Workspace(props) {

    const [ realmHeader, setRealmHeader ] = useState("Polaris-Realm");
    const [ realm, setRealm ] = useState("POLARIS");
    const [ catalogs, setCatalogs ] = useState();

    const bearer = 'Bearer ' + props.token;
    const fetchCatalogs = () => {
        fetch('/api/management/v1/catalogs', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': bearer
            }
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error(response.status);
            }
            return response.json();
        })
        .then((data) => setCatalogs(data.catalogs))
        .catch((error) => {
            message.error('An error occurred: ' + error.message);
            console.error(error);
        });
    };

    useEffect(fetchCatalogs, []);

    if (!catalogs) {
        return(<Spin/>);
    }

    return(
        <Layout style={{ height: "105vh" }}>
            <Header user={props.user} setUser={props.setUser} />
            <Layout hasSider={true}>
                <Router>
                <SideMenu catalogs={catalogs} />
                <Layout.Content style={{ margin: "15px" }}>
                    <Switch>
                        <Route path="/" key="home" exact={true}>
                            <Home catalogs={catalogs} token={props.token} fetchCatalogs={fetchCatalogs} />
                        </Route>
                        <Route path="/catalog/create" key="catalog-create" exact>
                            <Catalog token={props.token} fetchCatalogs={fetchCatalogs} realmHeader={realmHeader} realm={realm} />
                        </Route>
                        <Route path="/catalog/:catalogName" key="catalogSettings">
                            <Catalog token={props.token} fetchCatalogs={fetchCatalogs} realmHeader={realmHeader} realm={realm} />
                        </Route>
                        <Route path="/browse/:catalogName" key="catalogBrowse">
                            <Browse token={props.token} realmHeader={realmHeader} realm={realm} />
                        </Route>
                        <Route path="/principals" key="principals" exact>
                            <Principals token={props.token} realmHeader={realmHeader} realm={realm} />
                        </Route>
                        <Route path="/settings" key="settings" exact>
                            <Settings realm={realm} realmHeader={realmHeader} setRealm={setRealm} setRealmHeader={setRealmHeader} />
                        </Route>
                    </Switch>
                </Layout.Content>
                </Router>
            </Layout>
            <Layout.Footer>Apache®, Apache Polaris™ are either registered trademarks or trademarks of the Apache Software Foundation in the United States and/or other countries.</Layout.Footer>
        </Layout>
    );

}