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
import { Breadcrumb, Card, Row, Col, Space, Button, Table, Spin, Popconfirm, message } from 'antd';
import { HomeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

export default function Home(props) {

    const bearer = 'Bearer ' + props.token;

    const deleteCatalog = (catalog) => {
        fetch('/api/management/v1/catalogs/' + catalog, {
            method: 'DELETE',
            headers: {
                'Authorization': bearer
            }
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error(response.status);
            }
            return response;
        })
        .then((data) => {
            message.info('Catalog ' + catalog + ' has been removed');
            props.fetchCatalogs();
        })
        .catch((error) => {
            message.error('An error occurred: ' + error.message);
            console.error(error);
        })
    };

    const catalogColumns = [
        {
            title: 'Catalog',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type'
        },
        {
            title: '',
            key: 'action',
            render: (_,record) => (
                <Space>
                    <Button><EditOutlined/></Button>
                    <Popconfirm title="Delete Catalog"
                        description="Are you sure you want to delete catalog ?"
                        onConfirm={() => deleteCatalog(record.name)}
                        okText="Yes" cancelText="No">
                        <Button danger icon={<DeleteOutlined/>} />
                    </Popconfirm>
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
                    <Table columns={catalogColumns} dataSource={props.catalogs} />
                </Col>
            </Row>
        </Card>
        </>
    );
}