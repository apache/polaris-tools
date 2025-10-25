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
import { UserOutlined, BlockOutlined, SettingOutlined, DeleteOutlined, PlayCircleOutlined, LogoutOutlined, ApartmentOutlined, DashboardOutlined, AreaChartOutlined, NotificationOutlined, SafetyOutlined, TeamOutlined, BuildOutlined, CrownOutlined, ProfileOutlined, CheckSquareOutlined, PlusCircleOutlined } from '@ant-design/icons';
import Home from './home.tsx';

function SideMenu(props) {

    const[ collapsed, setCollapsed ] = useState(false);
    const[ catalogs, setCatalogs ] = useState();

    const bearer = 'Bearer ' + props.token;

    const fetchCatalogs = () => {
        fetch('./api/management/v1/catalogs', {
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
            message.error('An error occured: ' + error.message);
            console.error(error);
        });
    };

    useEffect(fetchCatalogs, []);

    if (!catalogs) {
        return(<Spin/>);
    }

    const catalogElementsMenu = catalogs.map((element) => {
        return({
           key: element.name,
           label:element.name,
           icon: <ApartmentOutlined/>
        });
    });
    const newCatalogMenu = [
        {
            key: 'catalog/create',
            label: 'Create New',
            icon: <PlusCircleOutlined/>,
        }
    ];

    const catalogMenu = newCatalogMenu.concat(catalogElementsMenu);

    const mainMenu = [
        { key: 'catalogs', label: 'Catalogs', icon: <BlockOutlined/>, children: catalogMenu },
        { key: 'governance', label: 'Governance', icon: <SafetyOutlined/>, children: [
            { key: 'principals', label: 'Principals', icon: <UserOutlined/> },
            { key: 'principal_roles', label: 'Principal Roles', icon: <TeamOutlined/> },
            { key: 'catalog_roles', label: 'Catalog Roles', icon: <BuildOutlined/> },
            { key: 'privileges', label: 'Privileges', icon: <CrownOutlined/> }
        ]},
        { key: 'policies', label: 'Policies & TMS', icon: <CheckSquareOutlined/> },
        { key: 'observe', label: 'Observability', icon: <DashboardOutlined/>, children: [
            { key: 'metrics', label: 'Metrics', icon: <AreaChartOutlined/> },
            { key: 'events', label: 'Events', icon: <NotificationOutlined/> }
        ]},
        { key: 'profiles', label: 'Profiles', icon: <ProfileOutlined/> },
        { key: 'settings', label: 'Settings', icon: <SettingOutlined/>, children: [
            { key: 'bootstrap', label: 'Bootstrap', icon: <PlayCircleOutlined/> },
            { key: 'purge', label: 'Purge', icon: <DeleteOutlined/> }
        ] }
    ];

    return(
        <Layout.Sider collapsible={true} collapsed={collapsed} onCollapse={newValue => setCollapsed(newValue)}>
            <Menu items={mainMenu} mode="inline"/>
        </Layout.Sider>
    );

}

function Header(props) {

    const { Search } = Input;

    const userMenu = [
        { key: 'user', label: props.user, icon: <UserOutlined/>, children: [
            { key: 'preferences', label: 'Preferences', icon: <SettingOutlined/> },
            { key: 'logout', label: 'Logout', icon: <LogoutOutlined/> }
        ] }
    ];

    return(
        <Layout.Header style={{ height: "80px", background: "#fff", padding: "5px", margin: "10px" }}>
            <Row align="middle" justify="center" wrap="false">
                <Col span={3}><Image src="./logo.png" preview={false} width={60}/></Col>
                <Col span={19}><Search /></Col>
                <Col span={2}><Menu items={userMenu} onClick={(e) => {
                    if (e.key === 'logout') {
                        props.setUser(null);
                    }
                    if (e.key === 'preferences') {
                        console.log(e);
                    }
                }} /></Col>
            </Row>
        </Layout.Header>
    );

}

export default function Workspace(props) {

    return(
        <Layout style={{ height: "105vh" }}>
            <Header user={props.user} setUser={props.setUser} />
            <Layout hasSider={true}>
                <Router>
                <SideMenu token={props.token} />
                <Layout.Content style={{ margin: "15px" }}>
                    <Switch>
                        <Route path="/" key="home" exact={true}>
                            <Home user={props.user} token={props.token} />
                        </Route>
                    </Switch>
                </Layout.Content>
                </Router>
            </Layout>
            <Layout.Footer>Apache®, Apache Polaris™ are either registered trademarks or trademarks of the Apache Software Foundation in the United States and/or other countries.</Layout.Footer>
        </Layout>
    );

}