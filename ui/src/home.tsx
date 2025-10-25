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
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb, Card, Row, Col, Space, Button, Table, Spin, message } from 'antd';
import { HomeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

export default function Home(props) {

    const [ catalogs, setCatalogs] = useState();
    const [ principals, setPrincipals ] = useState();

    const bearer = 'Bearer ' + props.token;

    const fetchCatalogs = () => {
        fetch('./api/management/v1/catalogs', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': bearer,
                }
            })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(response.status);
                }
                return response.json();
            })
            .then((data) => {
                console.log(data);
                setCatalogs(data.catalogs);
            })
            .catch((error) => {
                message.error('An error occurred: ' + error.message);
                console.error(error);
            })
    };

    useEffect(fetchCatalogs, []);

    if (!catalogs) {
        return(<Spin/>);
    }

    const catalogColumns = [
        {
            title: 'Catalog',
            dataIndex: 'catalog',
            key: 'catalog'
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type'
        },
        {
            title: 'Base Location',
            dataIndex: 'location',
            key: 'location'
        },
        {
            title: '',
            key: 'action',
            render: (_,record) => (
                <Space>
                    <Button><EditOutlined/></Button>
                    <Button><DeleteOutlined/></Button>
                </Space>
            )
        }
    ];

    return(
        <>
        <Breadcrumb items={[ { title: <Link to="/"><HomeOutlined/></Link> } ]} />
        <Card title="Overview" style={{ width: '100%' }}>
            <Row gutter={[16,16]}>
                <Col span={24}>
                    <Table columns={catalogColumns} dataSource={catalogs} />
                </Col>
            </Row>
        </Card>
        </>
    );
}