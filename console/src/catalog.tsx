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
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { Breadcrumb, Spin, Card, Form, Input, Select, Tabs, Collapse, Divider, Button, Space, Popconfirm, message } from 'antd';
import { HomeOutlined, ApartmentOutlined, AmazonOutlined, GoogleOutlined, CloudOutlined, FileSyncOutlined, SaveOutlined, PauseCircleOutlined, DeleteOutlined } from '@ant-design/icons';

function S3() {

    return(
        <>
        <Form.Item name="s3.roleArn" label="Role ARN">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.externalId" label="External ID">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.userArn" label="User ARN">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.region" label="Region">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.endpoint" label="Endpoint">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.endpointInternal" label="Endpoint internal">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.pathStyleAccess" label="Path style access">
            <Select options={[
                { value: 'true', label: 'Enabled' },
                { value: 'false', label: 'Disabled' }
            ]} />
        </Form.Item>
        <Form.Item name="s3.stsUnavailable" label="STS">
            <Select options={[
                { value: 'false', label: 'Enabled' },
                { value: 'true', label: 'Disabled' }
            ]} />
        </Form.Item>
        <Form.Item name="s3.stsEndpoint" label="STS endpoint">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.accountId" label="Account ID">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.partition" label="Partition">
            <Input allowClear={true} />
        </Form.Item>
        </>
    );
}

function GCP() {

    return(
        <>
        <Form.Item name="gcp.serviceAccount" label="Service account">
            <Input allowClear={true} />
        </Form.Item>
        </>
    );

}

function Azure() {

    return(
        <>
        <Form.Item name="azure.tenantId" label="Tenant ID">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="azure.multiTenantAppName" label="Multi tenant app name">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="azure.consentUrl" label="Consent URL">
            <Input allowClear={true} />
        </Form.Item>
        </>
    );

}

function StorageConfig() {

    const tabItems = [
        {
            key: 's3',
            label: 'S3',
            icon: <AmazonOutlined/>,
            children: <S3/>
        },
        {
            key: 'gcp',
            label: 'GCP',
            icon: <GoogleOutlined/>,
            children: <GCP/>
        },
        {
            key: 'azure',
            label: 'Azure',
            icon: <CloudOutlined/>,
            children: <Azure/>
        }
    ];

    return(
        <>
        <Form.Item name="storageType" label="Storage Type" rules={[{ required: true, message: 'The storage type is required' }]}>
            <Select options={[
                { value: 'S3', label: 'S3' },
                { value: 'GCP', label: 'GCP' },
                { value: 'AZURE', label: 'Azure' },
                { value: 'FILE', label: 'File' }
            ]}/>
        </Form.Item>
        <Form.Item name="location" label="Default Base Location" rules={[{ required: true, message: 'The storage location is required' }]}>
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="allowedLocations" label="Allowed locations">
            <Select mode="tags" />
        </Form.Item>
        <Tabs centered items={tabItems} />
        </>
    );

}

export default function Catalog(props) {

    const [ catalogDetail, setCatalogDetail ] = useState();

    const bearer = 'Bearer ' + props.token;
    const realmHeader = props.realmHeader;
    const realm = props.realm;

    const [ catalogForm ] = Form.useForm();

    let { catalogName } = useParams();

    const createCatalog = (values) => {
        const request = {
          'catalog': {
            'name': values.name,
            'type': values.type,
            'properties': {
                'default-base-location': values.location
            },
            'storageConfigInfo': {
                'storageType': values.storageType,
                'allowedLocations': values.allowedLocations
            }
          }
        };
        fetch('/api/management/v1/catalogs', {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json',
                realmHeader: realm,
                'Authorization': bearer
            }
        })
        .then((response) => {
            if(!response.ok) {
                throw new Error(response.status);
            }
            return response.json();
        })
        .then((data) => {
            console.log(data);
            message.info('Catalog ' + data.name + ' created.');
            props.fetchCatalogs();
            catalogName = data.name;
        })
        .catch((error) => {
            message.error('An error occurred: ' + error.message);
            console.error(error);
        });
    };

    let cardTitle = 'Create Catalog';
    let onFinish = createCatalog;
    let deleteButton = null;

    if (catalogName) {
        // get catalog details
        const fetchCatalogDetail = () => {
            fetch('/api/management/v1/catalogs/' + catalogName, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    realmHeader: realm,
                    'Authorization': bearer
                }
            })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(response.status);
                }
                return response.json();
            })
            .then((data) => {
                const catalogDetailValues = {
                    name: data.name,
                    type: data.type,
                    storageType: data.storageConfigInfo.storageType,
                    allowedLocations: data.storageConfigInfo.allowedLocations,
                };
                setCatalogDetail(catalogDetailValues);
            })
            .catch((error) => {
                message.error('An error occurred: ' + error.message);
                console.error(error);
            });
        };

        useEffect(fetchCatalogDetail, [catalogName]);

        if (!catalogDetail) {
            return(<Spin/>);
        }

        cardTitle = 'Catalog ' + catalogDetail.name;
        // TODO implement catalog update (PUT)
        onFinish = () => console.log('Update catalog');

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
                // TODO redirect to home with <Redirect />
            })
            .catch((error) => {
                message.error('An error occurred: ' + error.message);
                console.error(error);
            })
        };

        deleteButton = <Popconfirm title="Delete Catalog" description="Are you sure you want to delete this catalog ?" okText="Yes" cancelText="No" onConfirm={() => deleteCatalog(catalogDetail.name) }><Button danger icon={<DeleteOutlined/>}>Delete</Button></Popconfirm>;
    }

    return(
      <>
      <Breadcrumb items={[ { title: <Link to="/"><HomeOutlined/></Link> }, { title: <ApartmentOutlined/> } ]} />
      <Card title={cardTitle} style={{ width: '100%' }}>
        <Form name="catalog" form={catalogForm} labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            style={{ width: '100%' }}
            onFinish={onFinish} initialValues={catalogDetail}>
            <Form.Item name="name" label="Name" rules={[{ required: true, message: 'The catalog name is required' }]}>
                <Input allowClear={true} />
            </Form.Item>
            <Form.Item name="type" label="Type" rules={[{ required: true, message: 'The catalog type is required' }]}>
                <Select options={[
                    { value: 'INTERNAL', label: 'Internal' },
                    { value: 'EXTERNAL', label: 'External' }
                ]}/>
            </Form.Item>
            <Collapse items={[
                { key: '1', label: 'Storage specific configuration', children: <StorageConfig /> }
            ]}/>
            <Divider />
            <Collapse items={[
                { key: '1', label: 'Additional properties', children: <Form.Item name="properties" label="Additional properties"><Select mode="tags"/></Form.Item> }
            ]}/>
            <Divider />
            <Form.Item label={null}>
                <Space>
                    <Button type="primary" icon={<SaveOutlined/>} onClick={() => catalogForm.submit()}>Save</Button>
                    <Button icon={<PauseCircleOutlined/>} onClick={() => catalogForm.resetFields()}>Cancel</Button>
                    { deleteButton }
                </Space>
            </Form.Item>
        </Form>
      </Card>
      </>
    );

}